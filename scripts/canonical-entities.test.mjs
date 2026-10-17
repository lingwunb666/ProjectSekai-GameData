import test from 'node:test';
import assert from 'node:assert/strict';
import {expandEntities} from './canonical-entities.mjs';
const fixture=()=>({model:'regional-catalog-v5',section:'Items',entityEncoding:'shared-provenance-v1',
  sources:[{path:'exports/zh/ExportFixture.json',section:'Items',locale:'zh',sha256:'a'.repeat(64)}],
  entities:[{id:'/A',key:'Items|/A',section:'Items',names:{zh:null},descriptions:{zh:''},provenance:[[0,3],[0,4]],variantSources:{zh:0}}]});
test('source dictionary keeps provenance order, nulls and empty strings without mutating input',()=>{
  const wire=fixture(),original=structuredClone(wire),expanded=expandEntities(wire),row=expanded.entities[0];
  assert.deepEqual(wire,original);assert.equal(row.provenance.length,2);assert.equal(row.provenance[1].index,4);
  assert.deepEqual(row.variantSources.zh,row.provenance[0]);assert.equal(row.names.zh,null);assert.equal(row.descriptions.zh,'');
  const old={model:'regional-catalog-v4'};assert.equal(expandEntities(old),old);
});
test('bad indices, unknown formats, unused tables and cross-locale references fail closed',()=>{
  for(const corrupt of [
    s=>s.entities[0].variantSources.zh=2,
    s=>s.entities[0].provenance[0][0]=1,
    s=>s.entities[0].provenance[0][1]=-1,
    s=>s.entities[0].provenance[0][1]=0.5,
    s=>s.entities[0].variantSources.en=0,
    s=>s.sources.push({...s.sources[0],path:'exports/zh/ExportUnused.json'}),
    s=>s.sources.push(s.sources[0]),
    s=>s.sources[0].path='exports/en/ExportFixture.json',
    s=>s.entityEncoding='unknown'
  ]) {const s=fixture();corrupt(s);assert.throws(()=>expandEntities(s));}
});
