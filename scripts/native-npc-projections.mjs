import assert from 'node:assert/strict';

const resistanceFields=['DimRetRange','DimRetSteps','MaxCrowdControlTime','AbilityResistances','InjuryImmunities'];
const control='DamageDeformerControlType';
const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function shape(value,keys) {
  assert(object(value),'NPC projection object');
  assert.deepEqual(Object.keys(value).sort(),keys.slice().sort(),'NPC projection fields');
}
function identity(value) {
  assert(typeof value==='string'&&value.length<=1024&&/^\/(?:[A-Za-z0-9_.'-]+\/)*[A-Za-z0-9_.'-]+$/.test(value)
    &&!value.split('/').some(p=>p==='.'||p==='..'),'NPC projection identity');
}
function bounded(value,limit) { assert(Array.isArray(value)&&value.length<=limit,'NPC projection array bound'); }
function base(row) {
  identity(row.uniqueName);assert(typeof row.parentName==='string','NPC projection parent');
  if(row.parentName)identity(row.parentName);
  assert(row.ownTextSha256===null||typeof row.ownTextSha256==='string'&&/^[a-f0-9]{64}$/.test(row.ownTextSha256),'NPC source hash');
}
function roots(values) {
  bounded(values,1024);const selected=new Set();
  for(const value of values){identity(value);assert(!selected.has(value),'duplicate NPC root');selected.add(value);}
  return selected;
}
function visit(root,rows,used) {
  const seen=new Set();let id=root;
  while(id){assert(seen.size<100&&!seen.has(id)&&rows.has(id),'complete acyclic NPC projection ancestry');
    seen.add(id);used.add(id);id=rows.get(id).parentName;}
}
function closure(selected,rows) {
  const used=new Set();for(const root of selected)visit(root,rows,used);
  assert.deepEqual(used,new Set(rows.keys()),'unreferenced NPC projection declaration');
}
function finite(value) { assert(typeof value==='number'&&Number.isFinite(Math.fround(value)),'finite NPC scalar'); }

/** Optional own-region declarations; missing fields are never native defaults. */
export function verifyNpcAbilityResistance(input,npc) {
  if(input===undefined)return;
  shape(input,['schema','fields','roots','resources']);assert.equal(input.schema,1);
  assert.deepEqual(input.fields?.slice().sort(),resistanceFields.slice().sort(),'NPC resistance field inventory');
  const expected=new Set();
  for(const row of npc.values())for(const ref of row.references)
    if(ref.pointer==='/values/AbilityResistanceData'&&ref.status==='RESOLVED')expected.add(ref.resourceTarget);
  const selected=roots(input.roots);assert.deepEqual(selected,expected,'exact NPC resistance references');
  bounded(input.resources,2048);const rows=new Map();
  for(const row of input.resources) {
    shape(row,['uniqueName','parentName','ownTextSha256','values']);base(row);
    assert(!rows.has(row.uniqueName),'duplicate NPC resistance declaration');rows.set(row.uniqueName,row);
    assert(object(row.values)&&Object.keys(row.values).every(k=>resistanceFields.includes(k))
      &&(row.ownTextSha256!==null||Object.keys(row.values).length===0),'NPC resistance own fields');
    for(const [key,value]of Object.entries(row.values)) {
      if(key==='DimRetRange'){assert(Array.isArray(value)&&value.length===2,'NPC resistance range');value.forEach(finite);}
      else if(key==='DimRetSteps')assert(Number.isSafeInteger(value)&&value>=0,'NPC resistance steps');
      else if(key==='MaxCrowdControlTime')finite(value);
      else {bounded(value,64);for(const symbol of value)assert(typeof symbol==='string'&&/^[A-Z][A-Z0-9_]{0,127}$/.test(symbol),'NPC resistance symbol');}
    }
  }
  closure(selected,rows);
}

/** Scalar regeneration flags only; no visual assets or runtime deformer inference. */
export function verifyNpcDeformers(input,members,npc) {
  if(input===undefined)return;
  shape(input,['schema','fields','controllers','roots','resources']);assert.equal(input.schema,1);
  assert.deepEqual(input.fields,[control,'DamageDeformers/*/Results/*/regenerateIfNotDead']);
  const expected=new Set();for(const member of members)visit(member.uniqueName,npc,expected);
  bounded(input.controllers,8192);const actual=new Set(),referenced=new Set();
  for(const row of input.controllers) {
    shape(row,['uniqueName','parentName','ownTextSha256','values','reference']);base(row);
    assert(!actual.has(row.uniqueName)&&expected.has(row.uniqueName)
      &&npc.get(row.uniqueName).parentName===row.parentName,'NPC deformer controller binding');actual.add(row.uniqueName);
    assert(object(row.values)&&Object.keys(row.values).every(k=>k===control)
      &&(row.ownTextSha256!==null||Object.keys(row.values).length===0),'NPC deformer own fields');
    const value=row.values[control],ref=row.reference;
    assert(value===undefined||typeof value==='string','NPC deformer reference text');
    if(value===undefined||value===''){assert.equal(ref,null,'absent/cleared NPC deformer binding');continue;}
    shape(ref,['owner','pointer','rawTarget','status','resourceTarget']);
    assert(ref.owner===row.uniqueName&&ref.pointer==='/values/'+control&&ref.rawTarget===value,'NPC deformer reference owner');
    if(ref.status==='RESOLVED'){identity(ref.resourceTarget);referenced.add(ref.resourceTarget);}
    else assert(ref.status==='UNRESOLVED'&&ref.resourceTarget===null,'NPC deformer unresolved reference');
  }
  assert.deepEqual(actual,expected,'complete NPC deformer controllers');
  const selected=roots(input.roots);assert.deepEqual(selected,referenced,'exact NPC deformer references');
  bounded(input.resources,2048);const rows=new Map();
  for(const row of input.resources) {
    shape(row,['uniqueName','parentName','ownTextSha256','groups']);base(row);
    assert(!rows.has(row.uniqueName),'duplicate NPC deformer declaration');rows.set(row.uniqueName,row);
    assert(row.ownTextSha256!==null||row.groups===null,'native NPC root cannot declare groups');
    if(row.groups===null)continue;
    bounded(row.groups,256);let count=0;
    for(const group of row.groups){if(group===null)continue;bounded(group,64);count+=group.length;
      assert(count<=4096,'NPC deformer total results bound');
      for(const flag of group)assert(flag===null||typeof flag==='boolean','explicit NPC regeneration flag');}
  }
  closure(selected,rows);
}
