import assert from 'node:assert/strict';

// Script parameter declarations live in H.Font, not in the B.Font function body.
// Closed reviewed headers only; no script execution and no callback/default guessing.
export const SCRIPT_DEFAULT_HEADERS=[{
  id:'utility-health-conversion',resource:'/Lotus/Scripts/Mods/OnPickup.lua',bytes:386,
  sha256:'cfa33a0ca2a22518859276c6219b51f812bfc646d096d318273521ec9ff82229',
  values:{value:75},bindings:[{name:'value',nameOffset:161,nameLengthOffset:157,typeOffset:170,typeCode:1,valueOffset:180}]
}];
const HASH=/^[a-f0-9]{64}$/;
export function validateScriptParameterDefaults(id,row) {
  const spec=SCRIPT_DEFAULT_HEADERS.find(s=>s.id===id);
  if(!spec){assert.equal(row,undefined,'unexpected script parameter defaults');return;}
  assert(row&&row.schema==='native-script-parameter-defaults-v1','required script parameter defaults');
  assert.deepEqual(Object.keys(row).sort(),['schema','source','values']);
  const s=row.source;
  assert(s?.resource===spec.resource&&s.cache==='H.Font'&&s.bytes===spec.bytes&&s.decodedSha256===spec.sha256
    &&[s.tocSha256,s.compressedSha256].every(h=>typeof h==='string'&&HASH.test(h))
    &&typeof s.stamp==='string'&&/^[1-9]\d{0,19}$/.test(s.stamp),'own script parameter header');
  assert.deepEqual(row.values,spec.values,'reviewed script default values');
}

