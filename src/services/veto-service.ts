import crypto from 'node:crypto';
import { Prisma, VetoStatus } from '@prisma/client';
import { prisma } from '../lib/db.js';
import { assertAction, oppositeSide, secureCoinToss, secureRandomSide } from '../domain/veto.js';

const loadSession=(tx:Prisma.TransactionClient,id:string)=>tx.vetoSession.findUniqueOrThrow({where:{id},include:{steps:{orderBy:{stepNumber:'asc'}},actions:{orderBy:{createdAt:'desc'},include:{sideSelection:true,randomConfirmation:true}},event:{include:{maps:true}}}});
type Session=Awaited<ReturnType<typeof loadSession>>;
type Action={id:string;mapId:string};

const deadlineFor=(status:VetoStatus,session:Pick<Session,'mapSelectionSeconds'|'sideSelectionSeconds'>,now=new Date())=>{
  const seconds=status==='ACTIVE'?session.mapSelectionSeconds:status==='WAITING_FOR_SIDE_SELECTION'?session.sideSelectionSeconds:-1;
  return seconds<0?null:new Date(now.getTime()+seconds*1000);
};

async function automaticSide(tx:Prisma.TransactionClient,session:Session,step:Session['steps'][number],action:Action) {
  if(step.action==='BAN')return {needsSide:false,randomSide:false};
  if(step.sideSelectionMode==='PREASSIGNED'){
    if(!step.sideSelector||!step.preassignedSide)throw new Error('PREASSIGNED 選邊缺少預設隊伍或陣營');
    await tx.mapSideSelection.create({data:{vetoSessionId:session.id,vetoActionId:action.id,mapId:action.mapId,selector:step.sideSelector,selectorSide:step.preassignedSide,opponentSide:oppositeSide(step.preassignedSide),isDecider:step.action==='DECIDER'}});
    return {needsSide:false,randomSide:false};
  }
  if(step.sideSelectionMode==='RANDOM'){
    const teamASide=secureRandomSide();
    await tx.mapSideSelection.create({data:{vetoSessionId:session.id,vetoActionId:action.id,mapId:action.mapId,selector:'TEAM_A',selectorSide:teamASide,opponentSide:oppositeSide(teamASide),isDecider:step.action==='DECIDER'}});
    return {needsSide:false,randomSide:true};
  }
  return {needsSide:true,randomSide:false};
}

const createRandomConfirmation=(tx:Prisma.TransactionClient,sessionId:string,actionId:string)=>tx.randomConfirmation.create({data:{vetoSessionId:sessionId,vetoActionId:actionId}});

async function advanceAutomatic(tx:Prisma.TransactionClient,session:Session,start:number,used:Set<string>) {
  let next=start,needsSide=false,waitingRandom=false,autoDecider=false,coinTossWinner=session.coinTossWinner;
  while(next<session.steps.length&&session.steps[next]?.actor==='SYSTEM'){
    const step=session.steps[next]!,remaining=session.event.maps.map(map=>map.mapId).filter(mapId=>!used.has(mapId));
    if(!remaining.length)throw new Error('找不到可供系統抽選的剩餘地圖');
    const mapId=remaining[crypto.randomInt(remaining.length)]!,action=await tx.vetoAction.create({data:{vetoSessionId:session.id,vetoStepId:step.id,mapId,actor:'SYSTEM',action:step.action}});
    used.add(mapId);autoDecider||=step.action==='DECIDER';
    const side=await automaticSide(tx,session,step,action);needsSide=side.needsSide;
    waitingRandom=step.action!=='DECIDER'||side.randomSide;
    if(waitingRandom)await createRandomConfirmation(tx,session.id,action.id);
    if(needsSide&&step.sideSelectionMode==='COIN_TOSS'&&!coinTossWinner)coinTossWinner=secureCoinToss();
    if(!needsSide&&!waitingRandom)next+=1;
    break;
  }
  return {next,needsSide,waitingRandom,autoDecider,coinTossWinner};
}

const flowStatus=(result:{waitingRandom:boolean;needsSide:boolean;next:number},stepCount:number):{complete:boolean;status:VetoStatus}=>{
  const complete=!result.waitingRandom&&!result.needsSide&&result.next>=stepCount;
  return {complete,status:result.waitingRandom?'WAITING_FOR_RANDOM_CONFIRMATION':result.needsSide?'WAITING_FOR_SIDE_SELECTION':complete?'COMPLETED':'ACTIVE'};
};

export async function advanceAutomaticSteps(sessionId:string,expectedVersion:number) {
  return prisma.$transaction(async tx=>{
    const session=await loadSession(tx,sessionId);
    if(session.version!==expectedVersion)throw Object.assign(new Error('版本衝突，請重新同步'),{status:409});
    const result=await advanceAutomatic(tx,session,session.currentStep,new Set(session.actions.map(action=>action.mapId)));
    if(result.next===session.currentStep&&!result.needsSide&&!result.waitingRandom)return {advanced:false,complete:false,autoDecider:false};
    const flow=flowStatus(result,session.steps.length);
    const updated=await tx.vetoSession.updateMany({where:{id:session.id,version:expectedVersion},data:{currentStep:result.next,status:flow.status,actionDeadlineAt:deadlineFor(flow.status,session),completedAt:flow.complete?new Date():undefined,coinTossWinner:result.coinTossWinner,coinTossAt:result.coinTossWinner&&!session.coinTossAt?new Date():undefined,version:{increment:1}}});
    if(updated.count!==1)throw Object.assign(new Error('版本衝突，請重新同步'),{status:409});
    return {advanced:true,complete:flow.complete,autoDecider:result.autoDecider};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function submitMapAction(input:{sessionId:string;team:'TEAM_A'|'TEAM_B';mapId:string;expectedVersion:number}) {
  return prisma.$transaction(async tx=>{
    const session=await loadSession(tx,input.sessionId),step=session.steps[session.currentStep];if(!step)throw Object.assign(new Error('BP 已無待處理步驟'),{status:409});
    assertAction({status:session.status,currentStep:session.currentStep,version:session.version,expectedVersion:input.expectedVersion,step:{...step,resultOrder:step.resultOrder??undefined,customLabel:step.customLabel??undefined,sideSelector:step.sideSelector??undefined},team:input.team,mapUsed:session.actions.some(action=>action.mapId===input.mapId)});
    if(!session.event.maps.some(map=>map.mapId===input.mapId))throw Object.assign(new Error('地圖不在本場地圖池'),{status:400});
    const mapId=step.action==='DECIDER'?session.event.maps.map(map=>map.mapId).find(id=>!session.actions.some(action=>action.mapId===id)):input.mapId;if(!mapId)throw new Error('找不到剩餘 Decider 地圖');
    const action=await tx.vetoAction.create({data:{vetoSessionId:session.id,vetoStepId:step.id,mapId,actor:step.actor,action:step.action}}),used=new Set([...session.actions.map(existing=>existing.mapId),mapId]);
    const side=await automaticSide(tx,session,step,action);let needsSide=side.needsSide,waitingRandom=side.randomSide,next=needsSide||waitingRandom?session.currentStep:session.currentStep+1,autoDecider=false,coinTossWinner=session.coinTossWinner;
    if(waitingRandom)await createRandomConfirmation(tx,session.id,action.id);
    if(needsSide&&step.sideSelectionMode==='COIN_TOSS'&&!coinTossWinner)coinTossWinner=secureCoinToss();
    if(!needsSide&&!waitingRandom){const automatic=await advanceAutomatic(tx,session,next,used);next=automatic.next;needsSide=automatic.needsSide;waitingRandom=automatic.waitingRandom;autoDecider=automatic.autoDecider;coinTossWinner=automatic.coinTossWinner}
    const flow=flowStatus({waitingRandom,needsSide,next},session.steps.length);
    const updated=await tx.vetoSession.updateMany({where:{id:session.id,version:input.expectedVersion},data:{status:flow.status,currentStep:next,actionDeadlineAt:deadlineFor(flow.status,session),completedAt:flow.complete?new Date():undefined,coinTossWinner,coinTossAt:coinTossWinner&&!session.coinTossAt?new Date():undefined,version:{increment:1}}});if(updated.count!==1)throw Object.assign(new Error('版本衝突，請重新同步'),{status:409});
    return {actionId:action.id,needsSide,coinTossWinner,primary:{action:step.action,stepNumber:step.stepNumber,mapId},autoDecider,complete:flow.complete};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function submitSide(input:{sessionId:string;team:'TEAM_A'|'TEAM_B';side:'ATTACK'|'DEFENSE';expectedVersion:number;adminOverride?:boolean;reason?:string}) {
  return prisma.$transaction(async tx=>{
    const session=await loadSession(tx,input.sessionId);if(session.status!=='WAITING_FOR_SIDE_SELECTION'||session.version!==input.expectedVersion)throw Object.assign(new Error('選邊狀態或版本不符'),{status:409});
    const step=session.steps[session.currentStep],action=step?session.actions.find(candidate=>candidate.vetoStepId===step.id):undefined;if(!action||!step||action.sideSelection)throw Object.assign(new Error('無待處理選邊'),{status:409});
    const selectionActor=action.actor==='SYSTEM'?step.actor:action.actor;let selector=step.sideSelector;if(step.sideSelectionMode==='COIN_TOSS')selector=session.coinTossWinner;if(!selector&&step.sideSelectionMode==='PICKING_TEAM_SELECTS')selector=selectionActor==='TEAM_A'?'TEAM_A':'TEAM_B';if(!selector&&step.sideSelectionMode==='OPPONENT_SELECTS')selector=selectionActor==='TEAM_A'?'TEAM_B':'TEAM_A';
    if(!input.adminOverride&&selector!==input.team)throw Object.assign(new Error('此隊伍不是指定選邊方'),{status:403});if(input.adminOverride&&!input.reason?.trim())throw Object.assign(new Error('管理員覆寫必須提供原因'),{status:400});
    await tx.mapSideSelection.create({data:{vetoSessionId:session.id,vetoActionId:action.id,mapId:action.mapId,selector:selector||input.team,selectorSide:input.side,opponentSide:oppositeSide(input.side),isAdminOverride:Boolean(input.adminOverride),overrideReason:input.reason,isDecider:step.action==='DECIDER',fromCoinToss:step.sideSelectionMode==='COIN_TOSS'}});
    const automatic=await advanceAutomatic(tx,session,session.currentStep+1,new Set(session.actions.map(existing=>existing.mapId))),flow=flowStatus(automatic,session.steps.length);
    const updated=await tx.vetoSession.updateMany({where:{id:session.id,version:input.expectedVersion},data:{currentStep:automatic.next,status:flow.status,actionDeadlineAt:deadlineFor(flow.status,session),completedAt:flow.complete?new Date():undefined,coinTossWinner:automatic.coinTossWinner,coinTossAt:automatic.coinTossWinner&&!session.coinTossAt?new Date():undefined,version:{increment:1}}});if(updated.count!==1)throw Object.assign(new Error('版本衝突，請重新同步'),{status:409});
    return {complete:flow.complete,autoDecider:automatic.autoDecider,coinTossWinner:automatic.coinTossWinner,selectedActionId:action.id};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function confirmRandomResult(input:{sessionId:string;team:'TEAM_A'|'TEAM_B';expectedVersion:number}) {
  return prisma.$transaction(async tx=>{
    const session=await loadSession(tx,input.sessionId);
    if(session.status!=='WAITING_FOR_RANDOM_CONFIRMATION'||session.version!==input.expectedVersion)throw Object.assign(new Error('隨機結果確認狀態或版本不符'),{status:409});
    const step=session.steps[session.currentStep],action=step?session.actions.find(candidate=>candidate.vetoStepId===step.id):undefined,confirmation=action?.randomConfirmation;
    if(!step||!action||!confirmation)throw Object.assign(new Error('沒有待確認的隨機結果'),{status:409});
    const field=input.team==='TEAM_A'?'teamAConfirmedAt':'teamBConfirmedAt';
    if(confirmation[field])throw Object.assign(new Error('此隊伍已確認隨機結果'),{status:409});
    const updatedConfirmation=await tx.randomConfirmation.update({where:{id:confirmation.id},data:{[field]:new Date()}}),bothConfirmed=Boolean(updatedConfirmation.teamAConfirmedAt&&updatedConfirmation.teamBConfirmedAt);
    if(!bothConfirmed){await tx.vetoSession.update({where:{id:session.id},data:{version:{increment:1}}});return {complete:false,advanced:false,actionId:action.id}}
    const needsSide=step.action!=='BAN'&&!action.sideSelection;
    if(needsSide){await tx.vetoSession.update({where:{id:session.id},data:{status:'WAITING_FOR_SIDE_SELECTION',actionDeadlineAt:deadlineFor('WAITING_FOR_SIDE_SELECTION',session),version:{increment:1}}});return {complete:false,advanced:true,actionId:action.id}}
    const automatic=await advanceAutomatic(tx,session,session.currentStep+1,new Set(session.actions.map(existing=>existing.mapId))),flow=flowStatus(automatic,session.steps.length);
    await tx.vetoSession.update({where:{id:session.id},data:{currentStep:automatic.next,status:flow.status,actionDeadlineAt:deadlineFor(flow.status,session),completedAt:flow.complete?new Date():undefined,coinTossWinner:automatic.coinTossWinner,coinTossAt:automatic.coinTossWinner&&!session.coinTossAt?new Date():undefined,version:{increment:1}}});
    return {complete:flow.complete,advanced:true,actionId:action.id,autoDecider:automatic.autoDecider,coinTossWinner:automatic.coinTossWinner};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}

export async function confirmTeamReady(input:{sessionId:string;team:'TEAM_A'|'TEAM_B';expectedVersion:number}) {
  const ready=await prisma.$transaction(async tx=>{
    const session=await loadSession(tx,input.sessionId);
    if(session.status!=='WAITING_FOR_TEAMS'||session.version!==input.expectedVersion)throw Object.assign(new Error('準備狀態或版本不符'),{status:409});
    const field=input.team==='TEAM_A'?'teamAReadyAt':'teamBReadyAt';
    if(session[field])throw Object.assign(new Error('此隊伍已確認準備'),{status:409});
    const readyAt=new Date(),bothReady=input.team==='TEAM_A'?Boolean(session.teamBReadyAt):Boolean(session.teamAReadyAt);
    await tx.vetoSession.update({where:{id:session.id},data:{[field]:readyAt,status:bothReady?'ACTIVE':'WAITING_FOR_TEAMS',startsAt:bothReady?readyAt:undefined,actionDeadlineAt:bothReady?deadlineFor('ACTIVE',session,readyAt):null,version:{increment:1}}});
    return {started:bothReady};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
  if(ready.started)await advanceAutomaticSteps(input.sessionId,input.expectedVersion+1);
  return ready;
}

function sideSelector(session:Session,step:Session['steps'][number],action:Session['actions'][number]){
  if(step.sideSelectionMode==='COIN_TOSS')return session.coinTossWinner;
  if(step.sideSelector)return step.sideSelector;
  const selectionActor=action.actor==='SYSTEM'?step.actor:action.actor;
  if(step.sideSelectionMode==='PICKING_TEAM_SELECTS')return selectionActor==='TEAM_A'?'TEAM_A':'TEAM_B';
  return selectionActor==='TEAM_A'?'TEAM_B':'TEAM_A';
}

export async function processVetoTimeout(sessionId:string) {
  return prisma.$transaction(async tx=>{
    const session=await loadSession(tx,sessionId),now=new Date();
    if(!session.actionDeadlineAt||session.actionDeadlineAt>now||!['ACTIVE','WAITING_FOR_SIDE_SELECTION'].includes(session.status))return null;
    const step=session.steps[session.currentStep];if(!step)return null;
    if(session.status==='ACTIVE'){
      const remaining=session.event.maps.map(map=>map.mapId).filter(mapId=>!session.actions.some(action=>action.mapId===mapId));
      if(!remaining.length)return null;
      const mapId=remaining[crypto.randomInt(remaining.length)]!,responsible=step.actor==='TEAM_B'?'TEAM_B':'TEAM_A',action=await tx.vetoAction.create({data:{vetoSessionId:session.id,vetoStepId:step.id,mapId,actor:responsible,action:step.action,timeoutRandom:true}});
      const side=await automaticSide(tx,session,step,action);
      await tx.randomConfirmation.create({data:{vetoSessionId:session.id,vetoActionId:action.id,teamAConfirmedAt:responsible==='TEAM_A'?now:null,teamBConfirmedAt:responsible==='TEAM_B'?now:null}});
      const updated=await tx.vetoSession.updateMany({where:{id:session.id,version:session.version,actionDeadlineAt:{lte:now}},data:{status:'WAITING_FOR_RANDOM_CONFIRMATION',actionDeadlineAt:null,version:{increment:1}}});
      if(updated.count!==1)throw Object.assign(new Error('逾時處理版本衝突'),{status:409});
      return {team:responsible,kind:'MAP' as const,mapId,randomSide:side.randomSide};
    }
    const action=session.actions.find(candidate=>candidate.vetoStepId===step.id);if(!action||action.sideSelection)return null;
    const selector=sideSelector(session,step,action);if(!selector)return null;
    const selectedSide=secureRandomSide();
    await tx.vetoAction.update({where:{id:action.id},data:{timeoutRandom:true}});
    await tx.mapSideSelection.create({data:{vetoSessionId:session.id,vetoActionId:action.id,mapId:action.mapId,selector,selectorSide:selectedSide,opponentSide:oppositeSide(selectedSide),isDecider:step.action==='DECIDER',fromCoinToss:step.sideSelectionMode==='COIN_TOSS'}});
    await tx.randomConfirmation.create({data:{vetoSessionId:session.id,vetoActionId:action.id,teamAConfirmedAt:selector==='TEAM_A'?now:null,teamBConfirmedAt:selector==='TEAM_B'?now:null}});
    const updated=await tx.vetoSession.updateMany({where:{id:session.id,version:session.version,actionDeadlineAt:{lte:now}},data:{status:'WAITING_FOR_RANDOM_CONFIRMATION',actionDeadlineAt:null,version:{increment:1}}});
    if(updated.count!==1)throw Object.assign(new Error('逾時處理版本衝突'),{status:409});
    return {team:selector,kind:'SIDE' as const,side:selectedSide};
  },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
}
