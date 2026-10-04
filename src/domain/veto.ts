import crypto from 'node:crypto';
import { z } from 'zod';

export const Actor=z.enum(['TEAM_A','TEAM_B','SYSTEM']);
export const Action=z.enum(['BAN','PICK','DECIDER']);
export const SideMode=z.enum(['OPPONENT_SELECTS','PICKING_TEAM_SELECTS','PREASSIGNED','ADMIN_SELECTS','COIN_TOSS','RANDOM','NONE']);
export const StepSchema=z.object({stepNumber:z.number().int().positive(),actor:Actor,action:Action,resultOrder:z.number().int().positive().nullable().optional(),customLabel:z.string().max(100).nullable().optional(),sideSelectionMode:SideMode,sideSelector:z.enum(['TEAM_A','TEAM_B']).nullable().optional(),preassignedSide:z.enum(['ATTACK','DEFENSE']).nullable().optional()});
export type VetoStepInput=z.infer<typeof StepSchema>;

export function validateVetoSteps(steps: VetoStepInput[], poolSize=7) {
  const parsed=z.array(StepSchema).min(1).parse(steps);
  const errors:string[]=[];
  if(new Set(parsed.map(s=>s.stepNumber)).size!==parsed.length) errors.push('步驟編號不得重複');
  const deciders=parsed.filter(s=>s.action==='DECIDER');
  if(deciders.length!==1||parsed.at(-1)?.action!=='DECIDER') errors.push('Decider 必須唯一且位於最後');
  if(parsed.length!==poolSize) errors.push(`流程必須剛好處理 ${poolSize} 張地圖`);
  const orders=parsed.filter(s=>s.resultOrder!=null).map(s=>s.resultOrder);
  if(new Set(orders).size!==orders.length) errors.push('結果地圖順序不得重複');
  for(const s of parsed) {
    if(s.action==='DECIDER'&&s.actor!=='SYSTEM') errors.push('Decider 必須由 SYSTEM 執行');
    if(s.action==='BAN'&&s.sideSelectionMode!=='NONE') errors.push(`步驟 ${s.stepNumber}：Ban 不可選邊`);
    if((s.action==='PICK'||s.action==='DECIDER')&&s.sideSelectionMode==='NONE') errors.push(`步驟 ${s.stepNumber}：Pick/Decider 必須設定選邊方式`);
    if(s.sideSelectionMode==='PREASSIGNED'&&(!s.sideSelector||!s.preassignedSide)) errors.push(`步驟 ${s.stepNumber}：賽前指定必須包含隊伍與 Attack/Defense`);
  }
  if(errors.length) throw new Error(errors.join('；'));
  return parsed.sort((a,b)=>a.stepNumber-b.stepNumber);
}

const ban=(stepNumber:number,actor:'TEAM_A'|'TEAM_B'):VetoStepInput=>({stepNumber,actor,action:'BAN',sideSelectionMode:'NONE'});
const pick=(stepNumber:number,actor:'TEAM_A'|'TEAM_B',resultOrder:number):VetoStepInput=>({stepNumber,actor,action:'PICK',resultOrder,sideSelectionMode:'OPPONENT_SELECTS',sideSelector:actor==='TEAM_A'?'TEAM_B':'TEAM_A'});
const decider=(stepNumber:number,resultOrder:number,sideSelector:'TEAM_A'|'TEAM_B'):VetoStepInput=>({stepNumber,actor:'SYSTEM',action:'DECIDER',resultOrder,sideSelectionMode:'OPPONENT_SELECTS',sideSelector});

export function defaultStepsForBestOf(bestOf:1|3|5):VetoStepInput[] {
  if(bestOf===1) return [ban(1,'TEAM_A'),ban(2,'TEAM_B'),ban(3,'TEAM_A'),ban(4,'TEAM_B'),ban(5,'TEAM_A'),ban(6,'TEAM_B'),decider(7,1,'TEAM_A')];
  if(bestOf===5) return [ban(1,'TEAM_A'),ban(2,'TEAM_B'),pick(3,'TEAM_A',1),pick(4,'TEAM_B',2),pick(5,'TEAM_A',3),pick(6,'TEAM_B',4),decider(7,5,'TEAM_B')];
  return [ban(1,'TEAM_A'),ban(2,'TEAM_B'),pick(3,'TEAM_A',1),pick(4,'TEAM_B',2),ban(5,'TEAM_A'),ban(6,'TEAM_B'),decider(7,3,'TEAM_A')];
}

/** Backwards-compatible name used by existing tests and integrations. */
export function defaultBo7Steps():VetoStepInput[] { return defaultStepsForBestOf(3); }

export const oppositeTeam=(team:'TEAM_A'|'TEAM_B')=>team==='TEAM_A'?'TEAM_B':'TEAM_A';
export const oppositeSide=(side:'ATTACK'|'DEFENSE')=>side==='ATTACK'?'DEFENSE':'ATTACK';
export function secureCoinToss():'TEAM_A'|'TEAM_B' { return crypto.randomInt(2)===0?'TEAM_A':'TEAM_B'; }
export function secureRandomSide():'ATTACK'|'DEFENSE' { return crypto.randomInt(2)===0?'ATTACK':'DEFENSE'; }

export function assertAction(input:{status:string;currentStep:number;version:number;expectedVersion:number;step:VetoStepInput;team:'TEAM_A'|'TEAM_B';mapUsed:boolean}) {
  if(input.status!=='ACTIVE') throw Object.assign(new Error('BP 目前不可操作'),{status:409});
  if(input.version!==input.expectedVersion) throw Object.assign(new Error('版本衝突，請重新同步'),{status:409});
  if(input.step.stepNumber!==input.currentStep+1) throw Object.assign(new Error('目前步驟不符'),{status:409});
  if(input.step.actor!==input.team) throw Object.assign(new Error('目前不是此隊伍的操作步驟'),{status:403});
  if(input.mapUsed) throw Object.assign(new Error('此地圖已被處理'),{status:409});
}
