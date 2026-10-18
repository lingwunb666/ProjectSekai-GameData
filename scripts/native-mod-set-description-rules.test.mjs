import test from 'node:test';
import assert from 'node:assert/strict';
import {CALLER,GETTERS,verifyModSetDescriptionRules} from './native-mod-set-description-rules.mjs';
function fixture(){
  const source=s=>({resource:s.resource,cache:'B.Font',bytes:s.bytes,decodedSha256:s.sha256,stamp:'1234',tocSha256:'a'.repeat(64),compressedSha256:'b'.repeat(64)});
  const rows=GETTERS.map(s=>({schema:'native-mod-set-description-v1',uniqueName:'native-mod-set-'+s.id+'-v1',
    execution:'NO_SCRIPT_OR_CLIENT_EXECUTION',scope:'CATALOG_PRESENTATION_NOT_COMBAT',
    caller:{source:source(CALLER),format:{luau:9,types:3},function:{prototype:62,parameters:4,words:625}},
    getter:{source:source(s),format:{luau:9,types:3},function:{name:s.name,prototype:s.prototype,parameters:1,
      symbolHash:({GetLoc:2500553502,GetDescriptionInfo:3662879226,GetDescription:2213775760})[s.name],callerSymbolBinding:'native-luau-script-symbol-v1'}}}));
  return {data:{locale:'neutral',sections:{ClientModSetDescriptionRules:rows}},manifest:{inputs:[{clientExtraction:{sourceRecords:[source(CALLER),...GETTERS.map(source)]}}]}};
}
test('nine getters are optional independently but only original same-release bindings enable them',()=>{
  const {data,manifest}=fixture();verifyModSetDescriptionRules(data,manifest);
  assert.throws(()=>verifyModSetDescriptionRules(data,{}));
  for(const mutate of [r=>r.push(r[0]),r=>r[0].getter.source.stamp='99',r=>r[0].caller.source.bytes++,
    r=>r[0].caller.function.name='fabricated',r=>r[0].getter.function.parameters=2,r=>r[0].getter.source.decodedSha256='0'.repeat(64)]){
    const changed=structuredClone(data);mutate(changed.sections.ClientModSetDescriptionRules);assert.throws(()=>verifyModSetDescriptionRules(changed,manifest));
  }
  data.sections.ClientModSetDescriptionRules.pop();verifyModSetDescriptionRules(data,manifest);
  data.sections.ClientModSetDescriptionRules=[];verifyModSetDescriptionRules(data,manifest);
  const conflict=fixture();conflict.manifest.inputs.push({clientExtraction:{sourceRecords:[{cache:'B.Font',resource:CALLER.resource}]}});
  assert.throws(()=>verifyModSetDescriptionRules(conflict.data,conflict.manifest));
});
