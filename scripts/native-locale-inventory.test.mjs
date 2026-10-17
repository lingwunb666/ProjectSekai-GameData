import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLocaleInventory} from './native-locale-inventory.mjs';
function fixture(){
  const source={cache:'H.Misc_en',resource:'/Languages.bin',tocSha256:'a'.repeat(64),bytes:100,stamp:'1'};
  const inventory={schema:'client-locale-inventory-v1',scope:'LOCAL_INSTALLATION_AT_CAPTURE',observedFiles:['H.Misc_en.toc','H.Misc_en.cache','H.Misc_xx.toc','H.Misc_xx.cache'],
    locales:['en','zh','de','es','fr','it','ja','ko','pl','pt','ru','tc','th','tr','uk'].map(locale=>({locale,cache:'H.Misc_'+locale,
      state:locale==='en'?'DECODED':'NOT_INSTALLED',evidence:locale==='en'?{tocSha256:'a'.repeat(64),cacheBytes:100,resource:{stamp:'1',bytes:100,compressedBytes:50}}:null}))};
  return {inventory,manifest:{inputs:[{clientExtraction:{localeInventory:inventory}}]},sources:new Map([['en',source]])};
}
test('own decoded input, missing installed locales and unknown historical metadata stay distinct',()=>{
  const f=fixture(),result=verifyLocaleInventory(f.manifest,f.sources);
  assert.equal(result.en,'DECODED');assert.equal(result.de,'NOT_INSTALLED');assert(!Object.hasOwn(result,'xx'));
  assert.equal(Object.keys(result).length,15);assert.deepEqual(verifyLocaleInventory({},f.sources),{});
});
test('metadata cannot claim decoded data without the matching dictionary or ignore contradictions',()=>{
  const f=fixture();assert.throws(()=>verifyLocaleInventory(f.manifest),/state/);
  f.inventory.locales[0].evidence.tocSha256='b'.repeat(64);
  assert.throws(()=>verifyLocaleInventory(f.manifest,f.sources),/mismatch/);
  const changed=fixture();changed.inventory.locales[2].state='DECODED';assert.throws(()=>verifyLocaleInventory(changed.manifest,changed.sources),/state/);
  const missing=fixture();missing.inventory.locales.pop();assert.throws(()=>verifyLocaleInventory(missing.manifest,missing.sources),/coverage/);
});
