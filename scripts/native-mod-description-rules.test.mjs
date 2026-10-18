import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyModDescriptionRules} from './native-mod-description-rules.mjs';
function fixture(){return {locale:'neutral',sections:{ClientModDescriptionRules:[{
  schema:'native-mod-description-rules-v1',uniqueName:'native-mod-description-stats-v1',execution:'NO_SCRIPT_OR_CLIENT_EXECUTION',
  scope:'CATALOG_PRESENTATION_NOT_COMBAT',scripts:[
    ['/Lotus/Scripts/Mods/ModDescriptionStats.lua','d0ea80ce831094dce2cf400971dfd27bb34ee631e870c3baac05ca6d6f02ecb5',1161,
      [['GetEmptyDescriptionInfo',0,5,1504463757],['GetDescriptionInfo',1,5,3662879226]]],
    ['/EE/Interface/Utilities.lua','df58ebe84b5bf51bf0adfd2b171b4b36d551195cbd7db92aa1087a9a39ea7ad5',51977,[['FormatNumber',49,6,1440395046]]]
  ].map(([resource,decodedSha256,bytes,f])=>({source:{resource,decodedSha256,bytes,cache:'B.Font',stamp:'1234',
    tocSha256:'a'.repeat(64),compressedSha256:'b'.repeat(64)},format:{luau:9,types:3},functions:f.map(([name,prototype,parameters,symbolHash])=>({
      name,prototype,parameters,symbolHash,callerSymbolBinding:'native-luau-script-symbol-v1'}))}))
}]}};}
test('exact shared getter identities still require each regional release acquisition',()=>{
  const data=fixture(),manifest={inputs:[{clientExtraction:{sourceRecords:data.sections.ClientModDescriptionRules[0].scripts.map(s=>structuredClone(s.source))}}]};
  verifyModDescriptionRules(data,manifest);assert.throws(()=>verifyModDescriptionRules(data,{}));
  for(const mutate of [r=>r.scripts.pop(),r=>r.scripts[0].source.stamp='9999',r=>r.scripts[1].source.decodedSha256='a'.repeat(64),
    r=>r.scripts[0].functions[1].symbolHash=42,r=>r.scripts[0].functions[1].prototype=2,r=>r.scripts[0].source.bytes=1162]){
    const changed=fixture();mutate(changed.sections.ClientModDescriptionRules[0]);assert.throws(()=>verifyModDescriptionRules(changed,manifest));
  }
  const conflicting=structuredClone(manifest);conflicting.inputs.push({clientExtraction:{sourceRecords:[{cache:'B.Font',resource:'/EE/Interface/Utilities.lua'}]}});
  assert.throws(()=>verifyModDescriptionRules(data,conflicting));
});
