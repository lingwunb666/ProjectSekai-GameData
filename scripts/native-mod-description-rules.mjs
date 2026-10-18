import assert from 'node:assert/strict';
export function verifyModDescriptionRules(data,manifest) {
  const rows=data.sections?.ClientModDescriptionRules;if(rows===undefined)return;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length===1,'MOD description inventory');
  const row=rows[0];
  assert(row.schema==='native-mod-description-rules-v1'&&row.uniqueName==='native-mod-description-stats-v1'
    &&row.execution==='NO_SCRIPT_OR_CLIENT_EXECUTION'&&row.scope==='CATALOG_PRESENTATION_NOT_COMBAT','MOD rule identity');
  const expected=[['/Lotus/Scripts/Mods/ModDescriptionStats.lua','d0ea80ce831094dce2cf400971dfd27bb34ee631e870c3baac05ca6d6f02ecb5',1161,
    [['GetEmptyDescriptionInfo',0,5,1504463757],['GetDescriptionInfo',1,5,3662879226]]],
    ['/EE/Interface/Utilities.lua','df58ebe84b5bf51bf0adfd2b171b4b36d551195cbd7db92aa1087a9a39ea7ad5',51977,[['FormatNumber',49,6,1440395046]]]];
  assert(Array.isArray(row.scripts)&&row.scripts.length===2,'MOD rule scripts');
  for(const [resource,sha256,bytes,functions]of expected) {
    const matches=row.scripts.filter(s=>s.source?.resource===resource);assert.equal(matches.length,1);
    const script=matches[0],s=script.source;
    assert(s.cache==='B.Font'&&s.bytes===bytes&&s.decodedSha256===sha256
      &&[s.tocSha256,s.compressedSha256].every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h))
      &&typeof s.stamp==='string'&&/^[1-9]\d{0,19}$/.test(s.stamp),'MOD rule source');
    assert.deepEqual(script.format,{luau:9,types:3});
    assert.deepEqual(script.functions.map(f=>[f.name,f.prototype,f.parameters,f.symbolHash]),functions);
    assert(script.functions.every(f=>f.callerSymbolBinding==='native-luau-script-symbol-v1'));
    let visited=0,acquired=false;
    function visit(node,depth=0) {
      assert(node&&typeof node==='object'&&!Array.isArray(node)&&depth<=16&&++visited<=128,'MOD provenance bounds');
      if(node.clientExtraction?.sourceRecords!==undefined) {
        const records=node.clientExtraction.sourceRecords;assert(Array.isArray(records)&&records.length<=16384);
        for(const record of records)if(record.resource===resource&&record.cache===s.cache) {
          for(const key of ['cache','resource','bytes','stamp','tocSha256','compressedSha256','decodedSha256'])
            assert.deepEqual(record[key],s[key],'MOD source conflict');
          acquired=true;
        }
      }
      if(node.inputs!==undefined){assert(Array.isArray(node.inputs)&&node.inputs.length<=16);for(const input of node.inputs)visit(input,depth+1);}
    }
    visit(manifest);assert(acquired,'MOD source acquisition missing');
  }
}
