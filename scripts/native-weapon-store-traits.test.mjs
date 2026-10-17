import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyWeaponStoreTraits as verify} from './native-weapon-store-traits.mjs';

const artifact='exports/neutral/ExportClientWeaponStoreTraits.json';
function fixture() {
  const store='/Lotus/StoreItems/Test',root='/Lotus/Types/Game/StoreItemSpecializations/LotusWeaponStoreItem';
  return {locale:'neutral',sections:{ClientWeaponStoreTraits:[{uniqueName:store,itemTarget:'/Lotus/Test',
    rule:'native-weapon-store-trade-v1',nativeRoot:root,resourceChain:[store,root],attributeChainComplete:true,
    typeNameOwner:store,tradeable:false,tradeableOwner:null,defaultApplied:true}],
  ClientWeaponStoreTraitCoverage:{schema:'native-weapon-store-trade-v1',records:1,defaults:1,explicit:0,issues:[]}}};
}
test('native false default and explicit true retain separate provenance',()=>{
  const data=fixture();verify(artifact,data);
  const row=data.sections.ClientWeaponStoreTraits[0];row.defaultApplied=false;row.tradeable=true;row.tradeableOwner=row.uniqueName;
  Object.assign(data.sections.ClientWeaponStoreTraitCoverage,{defaults:0,explicit:1});verify(artifact,data);
});
test('unproven defaults, mismatched owners, duplicates and incomplete coverage are rejected',()=>{
  const mutations=[
    d=>d.sections.ClientWeaponStoreTraits[0].tradeable=true,
    d=>d.sections.ClientWeaponStoreTraits[0].typeNameOwner='/Lotus/Unrelated',
    d=>d.sections.ClientWeaponStoreTraits[0].resourceChain.push('/Lotus/Unknown'),
    d=>d.sections.ClientWeaponStoreTraits.push(d.sections.ClientWeaponStoreTraits[0]),
    d=>d.sections.ClientWeaponStoreTraitCoverage.defaults=0,
    d=>d.sections.ClientWeaponStoreTraitCoverage.issues.push({reason:'UNKNOWN'})
  ];
  for(const mutate of mutations){const data=fixture();mutate(data);assert.throws(()=>verify(artifact,data));}
});
test('older releases without this optional artifact are unaffected',()=>{
  verify('exports/neutral/ExportClientWeapons.json',{});
});
