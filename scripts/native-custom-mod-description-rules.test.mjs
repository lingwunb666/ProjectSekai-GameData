import test from 'node:test';
import assert from 'node:assert/strict';
import {GETTERS,verifyCustomModDescriptionRules} from './native-custom-mod-description-rules.mjs';
function fixture(){
  const source=s=>({resource:s.resource,cache:'B.Font',bytes:s.bytes,decodedSha256:s.sha256,stamp:'1234',tocSha256:'a'.repeat(64),compressedSha256:'b'.repeat(64)});
  const rows=GETTERS.map(s=>({schema:'native-custom-mod-description-v1',uniqueName:'native-custom-mod-'+s.id+'-v1',
    execution:'NO_SCRIPT_OR_CLIENT_EXECUTION',scope:'CATALOG_PRESENTATION_NOT_COMBAT',
    getter:{source:source(s),format:{luau:9,types:3},function:{name:s.name,prototype:s.prototype,parameters:s.parameters,
      symbolHash:s.symbolHash,callerSymbolBinding:s.binding??'native-luau-script-symbol-v1'}}}));
  return {data:{locale:'neutral',sections:{ClientCustomModDescriptionRules:rows}},manifest:{inputs:[{clientExtraction:{sourceRecords:GETTERS.map(source)}}]}};
}
test('each optional custom getter requires original same-release source and binding',()=>{
  const {data,manifest}=fixture();verifyCustomModDescriptionRules(data,manifest);
  assert.throws(()=>verifyCustomModDescriptionRules(data,{}));
  for(const mutate of [r=>r.push(r[0]),r=>r[0].getter.source.stamp='99',r=>r[0].getter.source.bytes++,
    r=>r[0].getter.function.parameters++,r=>r[0].getter.source.decodedSha256='0'.repeat(64)]){
    const changed=structuredClone(data);mutate(changed.sections.ClientCustomModDescriptionRules);assert.throws(()=>verifyCustomModDescriptionRules(changed,manifest));
  }
  data.sections.ClientCustomModDescriptionRules.pop();verifyCustomModDescriptionRules(data,manifest);
  data.sections.ClientCustomModDescriptionRules=[];verifyCustomModDescriptionRules(data,manifest);
  const conflict=fixture();conflict.manifest.inputs.push({clientExtraction:{sourceRecords:[{cache:'B.Font',resource:GETTERS[0].resource}]}});
  assert.throws(()=>verifyCustomModDescriptionRules(conflict.data,conflict.manifest));
});
