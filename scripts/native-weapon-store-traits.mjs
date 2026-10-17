import assert from 'node:assert/strict';

const artifact='exports/neutral/ExportClientWeaponStoreTraits.json';
const root='/Lotus/Types/Game/StoreItemSpecializations/LotusWeaponStoreItem';
const rule='native-weapon-store-trade-v1';
const resource=id=>typeof id==='string'&&id.startsWith('/Lotus/')&&!id.includes('..');

/** Independent public validation of static weapon-body trade provenance, not player eligibility. */
export function verifyWeaponStoreTraits(path,data) {
  if(path!==artifact)return;
  assert.equal(data.locale,'neutral');
  const rows=data.sections?.ClientWeaponStoreTraits,coverage=data.sections?.ClientWeaponStoreTraitCoverage;
  assert(Array.isArray(rows)&&rows.length>0&&rows.length<=4096,'weapon store trait count');
  const seen=new Set();let defaults=0;
  for(const row of rows) {
    assert(resource(row.uniqueName)&&row.uniqueName.startsWith('/Lotus/StoreItems/')
      &&!seen.has(row.uniqueName)&&resource(row.itemTarget),'weapon store identities');
    seen.add(row.uniqueName);
    assert.equal(row.rule,rule);assert.equal(row.nativeRoot,root);assert.equal(row.attributeChainComplete,true);
    assert.equal(typeof row.tradeable,'boolean');assert.equal(typeof row.defaultApplied,'boolean');
    const chain=row.resourceChain;
    assert(Array.isArray(chain)&&chain.length>=2&&chain.length<=100&&chain.every(resource),'bounded ancestry');
    assert.equal(new Set(chain).size,chain.length,'duplicate ancestor');
    assert.equal(chain[0],row.uniqueName);assert.equal(chain.at(-1),root);
    assert(chain.includes(row.typeNameOwner)&&row.typeNameOwner!==root,'TypeName declaration owner');
    if(row.defaultApplied) {
      defaults++;assert.equal(row.tradeableOwner,null);assert.equal(row.tradeable,false,'reviewed false default only');
    } else assert(typeof row.tradeableOwner==='string'&&chain.includes(row.tradeableOwner)
      &&row.tradeableOwner!==root,'Tradeable declaration owner');
  }
  assert.equal(coverage?.schema,rule);assert.equal(coverage.records,rows.length);
  assert.equal(coverage.defaults,defaults);assert.equal(coverage.explicit,rows.length-defaults);
  assert(Array.isArray(coverage.issues)&&coverage.issues.length===0,'incomplete trait coverage');
}
