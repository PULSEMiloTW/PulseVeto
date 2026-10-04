import {describe,expect,it} from 'vitest';
import {assertAction,defaultBo7Steps,defaultStepsForBestOf,oppositeSide,secureCoinToss,validateVetoSteps} from '../../src/domain/veto.js';

describe('veto rules',()=>{
  it('validates default seven-map flow',()=>expect(validateVetoSteps(defaultBo7Steps())).toHaveLength(7));
  it.each([1,3,5] as const)('creates a valid Bo%s flow',bestOf=>{
    const steps=validateVetoSteps(defaultStepsForBestOf(bestOf));
    expect(steps).toHaveLength(7);
    expect(steps.filter(step=>step.action!=='BAN')).toHaveLength(bestOf);
    expect(steps.at(-1)).toMatchObject({action:'DECIDER',sideSelector:bestOf===5?'TEAM_B':'TEAM_A'});
  });
  it('assigns the automatic Bo5 decider side selection to Team B',()=>{
    const decider=defaultStepsForBestOf(5).at(-1);
    expect(decider).toMatchObject({actor:'SYSTEM',action:'DECIDER',sideSelectionMode:'OPPONENT_SELECTS',sideSelector:'TEAM_B'});
  });
  it('requires decider last',()=>{const steps=defaultBo7Steps();steps[6]!.action='BAN';expect(()=>validateVetoSteps(steps)).toThrow(/Decider/)});
  it('resolves opponent side',()=>expect(oppositeSide('ATTACK')).toBe('DEFENSE'));
  it('coin toss returns a team',()=>expect(['TEAM_A','TEAM_B']).toContain(secureCoinToss()));
  it('rejects stale concurrent action',()=>expect(()=>assertAction({status:'ACTIVE',currentStep:0,version:2,expectedVersion:1,step:defaultBo7Steps()[0]!,team:'TEAM_A',mapUsed:false})).toThrow());
  it('prevents other team action',()=>expect(()=>assertAction({status:'ACTIVE',currentStep:0,version:1,expectedVersion:1,step:defaultBo7Steps()[0]!,team:'TEAM_B',mapUsed:false})).toThrow());
});
