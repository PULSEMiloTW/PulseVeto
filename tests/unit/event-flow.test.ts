import {describe,expect,it} from 'vitest';
import {defaultVctFlows,eventFlowSteps,mapPoolInput} from '../../src/domain/event-flow.js';

describe('event-specific flows',()=>{
  it('provides the three named VCT defaults',()=>{
    expect(defaultVctFlows.map(flow=>flow.name)).toEqual(['Bo1 (VCT)','Bo3 (VCT)','Bo5 (VCT)']);
    expect(defaultVctFlows.map(flow=>eventFlowSteps(flow,7).filter(step=>step.action!=='BAN').length)).toEqual([1,3,5]);
  });
  it('keeps manual last bans and assigns contiguous result order only to picks',()=>{
    const steps=eventFlowSteps({name:'Final ban',steps:[
      {actor:'TEAM_B',action:'PICK',sideSelector:'TEAM_B'},
      {actor:'TEAM_A',action:'PICK',sideSelector:'TEAM_B'},
      {actor:'TEAM_A',action:'BAN'},
    ]},3);
    expect(steps.map(step=>step.action)).toEqual(['PICK','PICK','BAN']);
    expect(steps.map(step=>step.resultOrder)).toEqual([1,2,null]);
    expect(steps.map(step=>step.sideSelectionMode)).toEqual(['PICKING_TEAM_SELECTS','OPPONENT_SELECTS','NONE']);
    expect(steps.map(step=>step.stepNumber)).toEqual([1,2,3]);
  });
  it('supports system map draws and random side assignment for Pick and Decider',()=>{
    const steps=eventFlowSteps({name:'Random',steps:[
      {actor:'TEAM_A',action:'BAN'},
      {actor:'SYSTEM',action:'PICK',sideSelector:'RANDOM'},
      {actor:'SYSTEM',action:'DECIDER',sideSelector:'RANDOM'},
    ]},3);
    expect(steps.map(step=>step.actor)).toEqual(['TEAM_A','SYSTEM','SYSTEM']);
    expect(steps.map(step=>step.sideSelectionMode)).toEqual(['NONE','RANDOM','RANDOM']);
  });
  it('rejects mismatched pools, missing selectors, all bans, and invalid automatic steps',()=>{
    const steps=[{actor:'TEAM_A',action:'BAN'},{actor:'TEAM_B',action:'PICK',sideSelector:'TEAM_A'}];
    expect(eventFlowSteps({name:'short',steps},3)).toHaveLength(2);
    expect(()=>eventFlowSteps({name:'test',steps:[...steps,steps[0],steps[1]]},3)).toThrow('最多只能處理');
    expect(()=>eventFlowSteps({name:'test',steps:[steps[0],{actor:'TEAM_B',action:'PICK'}]},2)).toThrow();
    expect(()=>eventFlowSteps({name:'test',steps:[{actor:'SYSTEM',action:'BAN'},steps[1]]},2)).toThrow('禁用地圖不可使用隨機抽選');
    expect(()=>eventFlowSteps({name:'test',steps:[steps[0],steps[0]]},2)).toThrow();
    expect(eventFlowSteps({name:'test',steps:[steps[0],{actor:'SYSTEM',action:'DECIDER',sideSelector:'TEAM_A'}]},2)[1]).toMatchObject({actor:'SYSTEM',action:'DECIDER',resultOrder:1,sideSelector:'TEAM_A'});
    for(const invalid of [[{actor:'SYSTEM',action:'DECIDER',sideSelector:'TEAM_A'},steps[1]],[steps[0],{actor:'TEAM_A',action:'DECIDER',sideSelector:'TEAM_A'}],[steps[0],{actor:'SYSTEM',action:'DECIDER'}]])expect(()=>eventFlowSteps({name:'test',steps:invalid},2)).toThrow();
    expect(()=>mapPoolInput.parse(['map','map'])).toThrow();
    expect(mapPoolInput.parse(['a','b'])).toHaveLength(2);
  });
});
