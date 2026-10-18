import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRailjack} from './native-railjack.mjs';
const fixture=()=>({locale:'neutral',sections:{ClientCatalogFamilyCoverage:{schema:'native-railjack-weapon-sources-v1',weapons:1,issues:[]},ClientRailjackWeapons:[{
  schema:'native-railjack-weapon-source-v1',productCategory:'CrewShipWeapons',uniqueName:'/Lotus/Ship',
  resourceChain:['/Lotus/Ship','/Lotus/Weapons/CrewShip/RailjackWeapon'],values:{AmmoClipSize:1000,AmmoCapacity:null},
  fieldSources:{AmmoClipSize:{resource:'/Lotus/Ship',field:'AmmoClipSize'},AmmoCapacity:null},behaviors:[]}]}});
test('ship facts keep unknown declarations and reject wrong family, owners, duplicates and incomplete coverage',()=>{
  const d=fixture();verifyRailjack(d);
  for(const mutate of [d=>d.sections.ClientRailjackWeapons[0].productCategory='LongGuns',
    d=>d.sections.ClientRailjackWeapons[0].fieldSources.AmmoClipSize.resource='/Lotus/Outside',
    d=>d.sections.ClientRailjackWeapons[0].resourceChain.pop(),d=>d.sections.ClientCatalogFamilyCoverage.issues.push('missing'),
    d=>{d.sections.ClientRailjackWeapons.push(d.sections.ClientRailjackWeapons[0]);d.sections.ClientCatalogFamilyCoverage.weapons=2;}]) {
    const bad=fixture();mutate(bad);assert.throws(()=>verifyRailjack(bad));
  }
});
