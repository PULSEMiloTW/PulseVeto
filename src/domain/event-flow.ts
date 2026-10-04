import {z} from 'zod';
import {defaultStepsForBestOf,type VetoStepInput} from './veto.js';

export const mapPoolInput=z.array(z.string().min(1)).min(2).max(20)
  .refine(ids=>new Set(ids).size===ids.length,'地圖不得重複');
const team=z.enum(['TEAM_A','TEAM_B']);
const sideSelector=z.union([team,z.literal('RANDOM')]);
export const eventFlowInput=z.object({
  name:z.string().trim().min(1).max(100),
  steps:z.array(z.object({
    actor:z.enum(['TEAM_A','TEAM_B','SYSTEM']),
    action:z.enum(['BAN','PICK','DECIDER']),
    sideSelector:sideSelector.nullable().optional(),
    sideSelectionMode:z.enum(['NONE','PICKING_TEAM_SELECTS','OPPONENT_SELECTS','RANDOM']).optional(),
  })).min(1).max(20),
});

export const defaultVctFlows=([1,3,5] as const).map(bestOf=>({
  name:`Bo${bestOf} (VCT)`,
  steps:defaultStepsForBestOf(bestOf).map(step=>({actor:step.actor,action:step.action,sideSelector:step.sideSelector??null})),
}));

export function eventFlowSteps(input:unknown,poolSize:number):VetoStepInput[] {
  const flow=eventFlowInput.parse(input);
  if(flow.steps.length>poolSize)throw Object.assign(new Error(`流程最多只能處理 ${poolSize} 張地圖`),{status:400});
  if(!flow.steps.some(step=>step.action!=='BAN'))throw Object.assign(new Error('流程至少需要選擇一張比賽地圖'),{status:400});
  let resultOrder=0;
  return flow.steps.map((step,index)=>{
    const randomSide=step.sideSelector==='RANDOM'||step.sideSelectionMode==='RANDOM';
    const selectedTeam=step.sideSelector==='TEAM_A'||step.sideSelector==='TEAM_B'?step.sideSelector:null;
    if(step.action==='DECIDER'&&(index!==flow.steps.length-1||step.actor!=='SYSTEM'))throw Object.assign(new Error('Decider 只能由系統在有效流程的最後一步執行'),{status:400});
    if(step.action==='BAN'&&step.actor==='SYSTEM')throw Object.assign(new Error(`步驟 ${index+1}：禁用地圖不可使用隨機抽選`),{status:400});
    if(step.action!=='BAN'&&!step.sideSelector&&!randomSide)throw Object.assign(new Error(`步驟 ${index+1} 必須指定選邊隊伍`),{status:400});
    return {stepNumber:index+1,actor:step.actor,action:step.action,
      resultOrder:step.action!=='BAN'?++resultOrder:null,
      sideSelectionMode:step.action==='BAN'?'NONE':randomSide?'RANDOM':step.actor===step.sideSelector?'PICKING_TEAM_SELECTS':'OPPONENT_SELECTS',
      sideSelector:step.action!=='BAN'&&!randomSide?selectedTeam:null};
  });
}
