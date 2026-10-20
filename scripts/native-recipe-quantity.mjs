import assert from 'node:assert/strict';
const identity=value=>typeof value==='string'&&/^\/(?:[A-Za-z0-9_.'-]+\/)*[A-Za-z0-9_.'-]+$/.test(value)
  &&value.split('/').every(v=>v!=='.'&&v!=='..');

/** Raw ancestry integrity only; does not assign a quantity or authorize game defaults. */
export function verifyRecipeQuantityAncestry(sections) {
  for(const section of ['ClientRecipes','ClientDojoRecipes']) {
    if(!Object.hasOwn(sections??{},section))continue;
    assert(Array.isArray(sections[section])&&sections[section].length<=10000,'bounded recipe rows');
    for(const row of sections[section]) {
      if(!Object.hasOwn(row,'quantityAncestry'))continue; // Older pinned releases.
      const e=row.quantityAncestry;
      assert(e&&typeof e==='object'&&!Array.isArray(e),'recipe quantity evidence');
      assert.deepEqual(Object.keys(e).sort(),['nativeRoot','opaqueLayers','resourceChain','schema']);
      assert.equal(e.schema,'recipe-quantity-ancestry-v1');
      assert(Array.isArray(e.resourceChain)&&e.resourceChain.length>0&&e.resourceChain.length<=100);
      assert(e.resourceChain.every(identity)&&new Set(e.resourceChain).size===e.resourceChain.length);
      assert.equal(e.resourceChain[0],row.uniqueName);assert.equal(e.resourceChain.at(-1),e.nativeRoot);
      if(Object.hasOwn(row,'familyRoot'))assert.equal(row.familyRoot,e.nativeRoot);
      assert(Array.isArray(e.opaqueLayers)&&new Set(e.opaqueLayers).size===e.opaqueLayers.length);
      assert(e.opaqueLayers.every(id=>e.resourceChain.includes(id)));
    }
  }
}
