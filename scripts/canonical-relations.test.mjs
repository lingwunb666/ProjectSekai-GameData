import assert from 'node:assert/strict';
import test from 'node:test';
import {expandRelation} from './canonical-relations.mjs';
const shard={model:'regional-catalog-v4',relationEncoding:'target-identity-elision-v1'};
test('v4 expands identical and declaration-scoped target IDs without altering ambiguity evidence or ordering',()=>{
  const row={rawTarget:'/Lotus/A',candidateSections:['Second','First'],resolution:'AMBIGUOUS',locale:'zh',pointer:'/items/0',conflictingTargetIds:['unchanged']};
  assert.deepEqual(expandRelation(shard,row),{rawTarget:'/Lotus/A',targetId:'/Lotus/A',candidates:['Second|/Lotus/A','First|/Lotus/A'],
    resolution:'AMBIGUOUS',locale:'zh',pointer:'/items/0',conflictingTargetIds:['unchanged']});
  assert.equal(expandRelation(shard,{...row,targetId:'/Lotus/B'}).candidates[0],'Second|/Lotus/B');
  const old={rawTarget:'/A',targetId:'/A',candidates:[]};assert.equal(expandRelation({model:'regional-catalog-v3'},old),old);
});
test('unknown encoding, duplicate sections and conflicting full/compact fields reject',()=>{
  const row={rawTarget:'/A',candidateSections:['X'],resolution:'RESOLVED'};
  assert.throws(()=>expandRelation({...shard,relationEncoding:'unknown'},row));
  assert.throws(()=>expandRelation(shard,{...row,candidateSections:['X','X']}));
  assert.throws(()=>expandRelation(shard,{...row,candidates:['X|/A']}));
  assert.throws(()=>expandRelation(shard,{...row,targetId:null}));
});
