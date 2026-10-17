import assert from 'node:assert/strict';
// Returns the original logical row. No sorting, filtering or guessed target identity.
export function expandRelation(shard,row) {
  if(!['regional-catalog-v4','regional-catalog-v5'].includes(shard.model)) {assert(!shard.relationEncoding);return row;}
  assert.equal(shard.relationEncoding,'target-identity-elision-v1');
  assert(!Object.hasOwn(row,'candidates')&&Array.isArray(row.candidateSections));
  assert(typeof row.rawTarget==='string'&&row.rawTarget.trim());
  const target=Object.hasOwn(row,'targetId')?row.targetId:row.rawTarget;
  assert(typeof target==='string'&&target.trim());
  const seen=new Set(),candidates=row.candidateSections.map(section=>{
    assert(typeof section==='string'&&/^[A-Za-z][A-Za-z0-9]*$/.test(section)&&!seen.has(section));
    seen.add(section);return section+'|'+target;
  });
  assert.equal(row.resolution,candidates.length===0?'UNRESOLVED':candidates.length===1?'RESOLVED':'AMBIGUOUS');
  const {candidateSections,...rest}=row;return {...rest,targetId:target,candidates};
}
