import { prisma } from '../lib/db.js';

export async function vetoSnapshot(vetoSessionId:string) {
  const s=await prisma.vetoSession.findUniqueOrThrow({where:{id:vetoSessionId},include:{event:{include:{maps:{orderBy:{sortOrder:'asc'},include:{map:true}}}},steps:{orderBy:{stepNumber:'asc'}},actions:{orderBy:[{step:{stepNumber:'asc'}},{createdAt:'asc'}],include:{map:true,sideSelection:true,randomConfirmation:true,result:true,step:true}}}});
  return {
    id:s.id,name:s.name,status:s.status,currentStep:s.currentStep,version:s.version,
    readiness:{teamAReady:Boolean(s.teamAReadyAt),teamBReady:Boolean(s.teamBReadyAt)},
    timer:{deadlineAt:s.actionDeadlineAt,mapSeconds:s.mapSelectionSeconds,sideSeconds:s.sideSelectionSeconds},
    event:{name:s.event.name,logo:s.event.logoPath||s.event.logoUrl,themeColor:s.event.themeColor},
    teams:{TEAM_A:{name:s.teamAName,logo:s.teamALogo},TEAM_B:{name:s.teamBName,logo:s.teamBLogo}},
    mapPool:s.event.maps.map(({map})=>({id:map.id,nameEn:map.nameEn,nameZhTw:map.nameZhTw,nameZhCn:map.nameZhCn,image:map.localImagePath||map.splashUrl})),
    steps:s.steps.map(x=>({stepNumber:x.stepNumber,actor:x.actor,action:x.action,resultOrder:x.resultOrder,customLabel:x.customLabel,sideSelectionMode:x.sideSelectionMode,sideSelector:x.sideSelector,completed:s.actions.some(a=>a.vetoStepId===x.id)})),
    actions:s.actions.map(a=>({id:a.id,stepNumber:a.step.stepNumber,resultOrder:a.step.resultOrder,actor:a.actor,action:a.action,timeoutRandom:a.timeoutRandom,map:{id:a.map.id,nameEn:a.map.nameEn,nameZhTw:a.map.nameZhTw,nameZhCn:a.map.nameZhCn,image:a.map.localImagePath||a.map.splashUrl},side:a.sideSelection?{selector:a.sideSelection.selector,selectorSide:a.sideSelection.selectorSide,opponentSide:a.sideSelection.opponentSide,isDecider:a.sideSelection.isDecider,fromCoinToss:a.sideSelection.fromCoinToss}:null,randomConfirmation:a.randomConfirmation?{teamAConfirmed:Boolean(a.randomConfirmation.teamAConfirmedAt),teamBConfirmed:Boolean(a.randomConfirmation.teamBConfirmedAt)}:null,result:a.result?{teamAScore:a.result.teamAScore,teamBScore:a.result.teamBScore,winner:a.result.winner,isNextMap:a.result.isNextMap,completedAt:a.result.completedAt}:null,at:a.createdAt})),
    coinToss:s.coinTossWinner?{winner:s.coinTossWinner,at:s.coinTossAt}:null,completedAt:s.completedAt,
  };
}

export function overlayDto(snapshot:Awaited<ReturnType<typeof vetoSnapshot>>) {
  const name=(t:'TEAM_A'|'TEAM_B')=>snapshot.teams[t].name;
  const played=snapshot.actions.filter(a=>a.action!=='BAN'),seriesScoreA=played.filter(a=>a.result?.winner==='TEAM_A').length,seriesScoreB=played.filter(a=>a.result?.winner==='TEAM_B').length;
  const orderedActions=snapshot.actions.slice().sort((a,b)=>a.stepNumber-b.stepNumber);
  const pendingStep=snapshot.steps[snapshot.currentStep];
  const selectorName=(stepNumber:number,selected?:'TEAM_A'|'TEAM_B')=>{const step=snapshot.steps.find(item=>item.stepNumber===stepNumber);if(step?.sideSelectionMode==='RANDOM')return 'Random';const selector=selected||step?.sideSelector;return selector?name(selector):''};
  return {currentActor:pendingStep?.actor||null,currentAction:pendingStep?.action||null,pendingSideSelector:pendingStep?.sideSelectionMode==='RANDOM'?'Random':pendingStep?.sideSelector?name(pendingStep.sideSelector):'',status:snapshot.status,currentStep:snapshot.currentStep,version:snapshot.version,eventName:snapshot.event.name,teamA:name('TEAM_A'),teamB:name('TEAM_B'),logoA:snapshot.teams.TEAM_A.logo||'',logoB:snapshot.teams.TEAM_B.logo||'',vctLogo:snapshot.event.logo||'',themeColor:snapshot.event.themeColor,seriesScoreA,seriesScoreB,mapPool:snapshot.mapPool,maps:orderedActions.map(a=>({actor:a.action==='DECIDER'?'Decider':a.actor==='SYSTEM'?'Random':a.actor==='TEAM_A'?'Team A':'Team B',action:a.action==='BAN'?'Veto':a.action==='DECIDER'?'Decider':'Pick',mapUuid:a.map.id,mapName:a.map.nameEn,mapNameZh:a.map.nameZhTw,mapNameZhCn:a.map.nameZhCn,mapImage:a.map.image||'',atkSide:a.side?.selectorSide==='ATTACK'?(a.side.selector==='TEAM_A'?'Team A':'Team B'):a.side?.opponentSide==='ATTACK'?(a.side.selector==='TEAM_A'?'Team B':'Team A'):'N/A',sideSelector:selectorName(a.stepNumber,a.side?.selector),sideSelection:a.side?.selectorSide||'',winner:a.result?.winner==='TEAM_A'?'Team A':a.result?.winner==='TEAM_B'?'Team B':'None',score:a.result?`${a.result.teamAScore}-${a.result.teamBScore}`:'',isNextMap:a.result?.isNextMap||false,isDecider:a.action==='DECIDER'}))};
}
