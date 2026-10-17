import assert from 'node:assert/strict';

const integer=(n,bound)=>{assert(Number.isInteger(n)&&n>=0&&n<bound,'Canonical source index');return n;};
export function expandEntities(shard) {
  if(shard.model!=='regional-catalog-v5')return shard;
  assert.equal(shard.entityEncoding,'shared-provenance-v1');
  assert(Array.isArray(shard.sources)&&shard.sources.length<=512);
  assert(Array.isArray(shard.entities)&&shard.entities.length<=2000);
  assert(/^[A-Za-z][A-Za-z0-9]*$/.test(shard.section));
  const distinct=new Set(),used=new Set();
  for(const source of shard.sources) {
    assert(source&&typeof source==='object'&&!Array.isArray(source));
    assert.deepEqual(Object.keys(source).sort(),['locale','path','section','sha256']);
    assert(/^exports\/(?:en|zh|tc|neutral)\/Export[A-Za-z0-9]+\.json$/.test(source.path));
    assert.equal(source.section,shard.section);assert.equal(source.locale,source.path.split('/')[1]);
    assert(/^[a-f0-9]{64}$/.test(source.sha256));
    const key=JSON.stringify([source.path,source.section,source.locale,source.sha256]);
    assert(!distinct.has(key),'Duplicate shared source');distinct.add(key);
  }
  const entities=shard.entities.map(row=>{
    assert(row&&typeof row==='object'&&!Array.isArray(row));
    assert.equal(row.section,shard.section);
    assert(Array.isArray(row.provenance)&&row.provenance.length>0&&row.provenance.length<=512);
    assert(row.variantSources&&typeof row.variantSources==='object'&&!Array.isArray(row.variantSources));
    assert(Object.keys(row.variantSources).length>0&&Object.keys(row.variantSources).length<=4);
    const seen=new Set();
    const provenance=row.provenance.map(ref=>{
      assert(Array.isArray(ref)&&ref.length===2);
      const source=integer(ref[0],shard.sources.length), index=integer(ref[1],2147483647);
      const key=source+':'+index;assert(!seen.has(key),'Duplicate source tuple');seen.add(key);used.add(source);
      return {...shard.sources[source],index};
    });
    assert.deepEqual([...new Set(provenance.map(p=>p.locale))].sort(),Object.keys(row.variantSources).sort());
    const variantSources=Object.fromEntries(Object.entries(row.variantSources).map(([locale,index])=>{
      const source=provenance[integer(index,provenance.length)];assert.equal(locale,source.locale);return [locale,source];
    }));
    return {...row,provenance,variantSources};
  });
  assert.equal(used.size,shard.sources.length,'Unused shared source');
  const result={...shard,entities};delete result.sources;delete result.entityEncoding;return result;
}
