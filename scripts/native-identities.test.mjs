import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeIdentities} from './native-identities.mjs';

const inventory={locale:'zh',sections:{ClientInventoryMiscItems:[
  {uniqueName:'/Lotus/StoreItems/A',typeName:'/Lotus/Actual',values:{TypeName:'/Lotus/Actual'},fieldSources:{TypeName:'/Lotus/StoreItems/A'}},
  {uniqueName:'/Lotus/StoreItems/B',typeName:'/Lotus/Actual',values:{TypeName:'/Lotus/Actual'},fieldSources:{TypeName:'/Lotus/StoreItems/B'}}]}};
const anchor=()=>({locale:'neutral',sections:{ClientItemIdentities:[
  {uniqueName:'/Lotus/Actual',identityRule:'explicit-store-typename-v1',storeItems:['/Lotus/StoreItems/B','/Lotus/StoreItems/A']}]}});
test('anchor verification is order-independent and tolerates repeated same-locale-independent inventory facts',()=>{
  const check=new NativeIdentities();check.accept(anchor());check.accept(inventory);check.accept({...inventory,locale:'en'});
  assert.deepEqual(check.verify(),new Set(['/Lotus/Actual']));
});

test('separate inventory detail and referenced upgrade sections are not duplicate store-membership claims',()=>{
  const check=new NativeIdentities();check.accept(anchor());check.accept(inventory);
  check.accept({locale:'neutral',sections:{ClientInventoryDetails:[{uniqueName:'/Lotus/StoreItems/A',itemTarget:'/Lotus/Actual'}],
    ClientInventoryRandomUpgrades:[{uniqueName:'/Lotus/Random'}],ClientInventorySubroutines:[{uniqueName:'/Lotus/Subroutine'}]}});
  assert.deepEqual(check.verify(),new Set(['/Lotus/Actual']));
  assert.throws(()=>check.accept({sections:{ClientInventoryMiscItems:[{uniqueName:'/Lotus/NotStore'}]}}));
});
test('wrong, incomplete and duplicate store claims are not accepted',()=>{
  const bad=anchor();bad.sections.ClientItemIdentities[0].storeItems.pop();
  const check=new NativeIdentities();check.accept(inventory);check.accept(bad);assert.throws(()=>check.verify(),/membership/);
  const empty=new NativeIdentities();empty.accept(inventory);empty.accept({locale:'neutral',sections:{ClientItemIdentities:[]}});
  assert.throws(()=>empty.verify(),/Incomplete/);
  bad.sections.ClientItemIdentities[0].storeItems.push('/Lotus/StoreItems/B');
  assert.throws(()=>new NativeIdentities().accept(bad),/Duplicate/);
});
test('legacy packages without identity claims remain readable, but localized anchors are rejected',()=>{
  const old=new NativeIdentities();old.accept(inventory);assert.equal(old.verify().size,0);
  assert.throws(()=>new NativeIdentities().accept({...anchor(),locale:'zh'}),/language-neutral/);
});
test('derived top-level identity cannot contradict the declared native TypeName',()=>{
  const wrong=structuredClone(inventory);wrong.sections.ClientInventoryMiscItems[0].values.TypeName='/Lotus/Other';
  const check=new NativeIdentities();check.accept(wrong);check.accept(anchor());
  assert.throws(()=>check.verify(),/explicit native TypeName/);
});
