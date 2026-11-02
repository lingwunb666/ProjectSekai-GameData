import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNpcAbilityResistance,verifyNpcDeformers} from './native-npc-projections.mjs';

const hash='a'.repeat(64),controller='/Lotus/Controller',root='/EE/Controller',definition='/Lotus/Definition';
function resistance() {
  return {schema:1,fields:['DimRetRange','DimRetSteps','MaxCrowdControlTime','AbilityResistances','InjuryImmunities'],
    roots:[definition],resources:[{uniqueName:definition,parentName:'',ownTextSha256:hash,
      values:{DimRetRange:[.1,.5],DimRetSteps:3,MaxCrowdControlTime:-1,AbilityResistances:['STUN'],InjuryImmunities:[]}}]};
}
const resistanceNpc=new Map([[controller,{references:[{pointer:'/values/AbilityResistanceData',status:'RESOLVED',resourceTarget:definition}]}]]);
test('resistance projection preserves finite declarations and exact reference closure',()=>{
  const source=resistance(),before=structuredClone(source);
  verifyNpcAbilityResistance(undefined,resistanceNpc);verifyNpcAbilityResistance(source,resistanceNpc);assert.deepEqual(source,before);
  for(const mutate of [x=>x.roots=[],x=>x.roots.push(definition),x=>x.resources[0].parentName=definition,
    x=>x.resources[0].ownTextSha256=null,x=>x.resources[0].values.DimRetSteps=.5,
    x=>x.resources[0].values.DimRetRange=[0,1e100],x=>x.resources[0].values.AbilityResistances=['unknown'],
    x=>x.resources[0].values.Unreviewed=1,x=>x.fields.push('DimRetSteps'),x=>x.resources.push({...x.resources[0],uniqueName:'/Unused'})]) {
    const bad=resistance();mutate(bad);assert.throws(()=>verifyNpcAbilityResistance(bad,resistanceNpc));
  }
});
const npc=new Map([[controller,{parentName:root}],[root,{parentName:''}]]),members=[{uniqueName:controller}];
function deformers() {
  return {schema:1,fields:['DamageDeformerControlType','DamageDeformers/*/Results/*/regenerateIfNotDead'],
    controllers:[{uniqueName:controller,parentName:root,ownTextSha256:hash,values:{DamageDeformerControlType:definition},
      reference:{owner:controller,pointer:'/values/DamageDeformerControlType',rawTarget:definition,status:'RESOLVED',resourceTarget:definition}},
      {uniqueName:root,parentName:'',ownTextSha256:null,values:{},reference:null}],
    roots:[definition],resources:[{uniqueName:definition,parentName:'',ownTextSha256:hash,groups:[null,[],[null,false,true]]}]};
}
test('deformer projection preserves sparse flags and rejects incomplete or misbound source chains',()=>{
  const source=deformers(),before=structuredClone(source);
  verifyNpcDeformers(undefined,members,npc);verifyNpcDeformers(source,members,npc);assert.deepEqual(source,before);
  for(const mutate of [x=>x.controllers.pop(),x=>x.controllers[0].parentName='',x=>x.controllers[0].reference.owner=root,
    x=>x.controllers[0].values.DamageDeformerControlType='',x=>x.roots=[],x=>x.roots.push(definition),
    x=>x.resources[0].parentName='/Missing',x=>x.resources[0].parentName=definition,
    x=>x.resources[0].ownTextSha256=null,x=>x.resources[0].groups=[[0]],x=>x.resources[0].groups=[[false,undefined]],
    x=>x.resources[0].groups=Array.from({length:65},()=>Array(64).fill(false)),
    x=>x.resources.push({...x.resources[0],uniqueName:'/Unused'})]) {
    const bad=deformers();mutate(bad);assert.throws(()=>verifyNpcDeformers(bad,members,npc));
  }
});
test('cleared and unresolved deformer references never manufacture a resource or default',()=>{
  const source=deformers();source.roots=[];source.resources=[];
  source.controllers[0].reference.status='UNRESOLVED';source.controllers[0].reference.resourceTarget=null;
  verifyNpcDeformers(source,members,npc);
  source.controllers[0].values.DamageDeformerControlType='';source.controllers[0].reference=null;
  verifyNpcDeformers(source,members,npc);
});
