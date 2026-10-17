import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeNpc,npcView} from './native-npc.mjs';
const root='/EE/Types/Npc/NpcAgent',child='/Lotus/Child';
function fixture() {
  const sections={ClientNpcAgents:[{uniqueName:child,selectionRule:'native-npc-reference-closure-v1'}],
    ClientNpcAvatars:[],ClientNpcDamageControllers:[],ClientNpcHitProxies:[],ClientNpcResources:[
      {uniqueName:root,parentName:'',values:{BaseLevel:1,NewAdditionalInventory:[{item:'/Lotus/Weapon'}]},referenceRule:'native-declaration-scope-v2',
        references:[{pointer:'/values/NewAdditionalInventory/0/item',owner:root,rawTarget:'/Lotus/Weapon',resourceTarget:'/Lotus/Weapon',status:'RESOLVED'}]},
      {uniqueName:child,parentName:root,values:{BaseLevel:0,NewAdditionalInventory:[]},referenceRule:'native-declaration-scope-v2',references:[]}]};
  const coverage={schema:'client-npc-facts-v1',encoding:'native-npc-owned-values-v1',selectionRoot:root,resources:2,issues:[],
    sections:{ClientNpcAgents:1,ClientNpcAvatars:0,ClientNpcDamageControllers:0,ClientNpcHitProxies:0},
    fields:{ClientNpcAgents:['BaseLevel','NewAdditionalInventory','MaxLevel'],ClientNpcAvatars:['MaxHealth'],ClientNpcDamageControllers:['MaxShield'],ClientNpcHitProxies:['DamageAtten']}};
  return {sections,coverage};
}
function check(f) {
  const c=new NativeNpc();c.accept('exports/neutral/ExportClientNpc.json',{locale:'neutral',sections:f.sections});
  c.accept('exports/neutral/ExportClientNpcCoverage.json',{locale:'neutral',sections:{ClientNpcCoverage:f.coverage}});c.verify(true);
}
test('NPC sparse own-values preserve explicit zero/empty and missing defaults',()=>{
  const f=fixture();check(f);
  const view=npcView(f.sections,f.coverage.fields,'ClientNpcAgents',child);
  assert.equal(view.values.BaseLevel,0);assert.equal(view.values.MaxLevel,null);
  assert.deepEqual(view.values.NewAdditionalInventory,[]);assert.deepEqual(view.references,[]);
  assert.deepEqual(view.fieldSources.BaseLevel,{resource:child,field:'BaseLevel'});
});
test('NPC dangling/cyclic chains, wrong owners, missing capability and counts reject',()=>{
  new NativeNpc().verify(false);assert.throws(()=>new NativeNpc().verify(true));
  for(const mutate of [f=>f.sections.ClientNpcResources[1].parentName=child,
    f=>f.sections.ClientNpcResources[1].parentName='/Lotus/Missing',
    f=>f.sections.ClientNpcResources[0].references[0].owner=child,
    f=>f.coverage.resources=3,f=>f.sections.ClientNpcResources[0].references=[]]){
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
