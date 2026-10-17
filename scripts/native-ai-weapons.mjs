import assert from 'node:assert/strict';
const DATA='exports/neutral/ExportClientAiWeapons.json',COVERAGE='exports/neutral/ExportClientAiWeaponCoverage.json';
const ROOTS=new Set(['/Lotus/Types/Game/LotusWeapon','/Lotus/Weapons/Tenno/LotusBulletWeapon',
  '/Lotus/Types/Game/LotusMeleeWeapon','/Lotus/Weapons/Tenno/Pistol/LotusPistol']);
const resource=id=>typeof id==='string'&&/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(id)
  &&id.split('/').every(p=>p!=='.'&&p!=='..');
const object=x=>x&&typeof x==='object'&&!Array.isArray(x);
function chain(row) {
  assert(Array.isArray(row.resourceChain)&&row.resourceChain.length>0&&row.resourceChain.length<100);
  assert.equal(row.resourceChain[0],row.uniqueName);assert(row.resourceChain.every(resource));
  assert.equal(new Set(row.resourceChain).size,row.resourceChain.length);
}
function indexed(rows) {
  assert(Array.isArray(rows)&&rows.length<=16384);const map=new Map();
  for(const row of rows){assert(resource(row.uniqueName)&&!map.has(row.uniqueName));map.set(row.uniqueName,row);}return map;
}
export function expandAiProjectile(wire,profile,binding) {
  assert.equal(wire.schema,'native-projectile-facts-v2');assert.equal(wire.encoding,'native-projectile-unknown-fields-v1');
  assert(profile&&profile.uniqueName===wire.unknownFields&&Array.isArray(profile.fields)&&profile.fields.length<=256);
  assert(binding.uniqueName===wire.uniqueName&&typeof binding.reference==='string'&&resource(binding.referenceOwner));
  const {unknownFields,encoding,...facts}=structuredClone(wire),seen=new Set();chain(facts);
  assert(object(facts.fieldSources)&&object(facts.values)&&object(facts.attacks));
  for(const key of profile.fields) {
    assert(typeof key==='string'&&/^[A-Za-z][A-Za-z0-9_]*(?:\.[A-Za-z][A-Za-z0-9_]*)?$/.test(key));
    assert(!seen.has(key)&&!Object.hasOwn(facts.fieldSources,key));seen.add(key);
    const parts=key.split('.'),target=parts.length===1?facts.values:facts.attacks[parts[0]],field=parts.at(-1);
    assert(object(target)&&!Object.hasOwn(target,field),'Unknown projectile value overwrite');target[field]=null;facts.fieldSources[key]=null;
  }
  const expected=new Map(Object.entries(facts.values));
  for(const [attack,values]of Object.entries(facts.attacks)) {
    assert(object(values)&&values.sourceFormat==='native-attack-facts-v2');
    for(const [key,value]of Object.entries(values))if(key!=='sourceFormat')expected.set(attack+'.'+key,value);
  }
  assert.equal(expected.size,Object.keys(facts.fieldSources).length);
  for(const [key,value]of expected) {
    assert(Object.hasOwn(facts.fieldSources,key));const source=facts.fieldSources[key];
    if(source===null)assert.equal(value,null);else assert(source.field===key&&facts.resourceChain.includes(source.resource));
  }
  return {...facts,reference:binding.reference,referenceOwner:binding.referenceOwner};
}
export class NativeAiWeapons {
  #sections;#coverage;#targets=new Set();#npcSeen=false;
  accept(path,data) {
    if(path==='exports/neutral/ExportClientNpc.json') {
      this.#npcSeen=true;
      for(const row of data.sections.ClientNpcResources??[])for(const ref of row.references??[])
        if(ref.pointer.startsWith('/values/NewAdditionalInventory/')&&ref.status==='RESOLVED')this.#targets.add(ref.resourceTarget);
    }
    if(path===DATA){assert(!this.#sections&&data.locale==='neutral');this.#sections=data.sections;}
    if(path===COVERAGE){assert(!this.#coverage&&data.locale==='neutral');this.#coverage=data.sections.ClientAiWeaponCoverage;}
    for(const key of Object.keys(data.sections??{}))if(key.startsWith('ClientAi'))assert(path===(key==='ClientAiWeaponCoverage'?COVERAGE:DATA));
  }
  verify(required) {
    if(!required&&!this.#sections&&!this.#coverage)return;
    const s=this.#sections,c=this.#coverage;assert(s&&c&&this.#npcSeen,'Incomplete AI weapon capability');
    assert.equal(c.schema,'client-ai-weapon-facts-v1');assert.equal(c.encoding,'native-owned-behaviors-v1');assert(Array.isArray(c.issues));
    assert.deepEqual(Object.keys(s).sort(),['ClientAiInventory','ClientAiWeapons','ClientAiWeaponBehaviors','ClientAiProjectiles','ClientAiUnknownFields'].sort());
    assert.deepEqual(c.weaponRoots,[...ROOTS].sort());assert.equal(c.inventoryTargets,this.#targets.size);
    const items=indexed(s.ClientAiInventory),weapons=indexed(s.ClientAiWeapons),pools=indexed(s.ClientAiWeaponBehaviors),shots=indexed(s.ClientAiProjectiles);
    const profiles=new Map();assert(Array.isArray(s.ClientAiUnknownFields)&&s.ClientAiUnknownFields.length<=16384);
    for(const p of s.ClientAiUnknownFields){assert(/^unknown-fields-\d+$/.test(p.uniqueName)&&!profiles.has(p.uniqueName));profiles.set(p.uniqueName,p);}
    const failures=new Set(c.issues.filter(r=>r.reason==='UNPARSED_AI_INVENTORY_ITEM').map(r=>r.resource));
    for(const target of this.#targets)assert(items.has(target)||failures.has(target),'Missing AI inventory target');
    for(const [id,row]of items) {
      chain(row);assert(this.#targets.has(id));assert.equal(row.nativeRoot,row.resourceChain.at(-1));
      assert.equal(row.kind,ROOTS.has(row.nativeRoot)?'WEAPON':'OTHER_ITEM');
      if(row.kind==='WEAPON')assert(weapons.has(id)||failures.has(id));else assert(!weapons.has(id),'Nonweapon treated as damage weapon');
    }
    const usedPools=new Set(),usedShots=new Set(),usedProfiles=new Set();let bindings=0;
    for(const [id,row]of weapons) {
      const item=items.get(id);assert(item&&item.kind==='WEAPON');assert.deepEqual(row.resourceChain,item.resourceChain);
      assert.equal(row.productCategory,null);assert(object(row.values)&&object(row.fieldSources));
      assert.deepEqual(Object.keys(row.values).sort(),Object.keys(row.fieldSources).sort());
      for(const [field,source]of Object.entries(row.fieldSources))if(source===null)assert.equal(row.values[field],null);
      else assert(source.field===field&&row.resourceChain.includes(source.resource));
      if(row.behaviorOwner===null)continue;
      assert(row.resourceChain.includes(row.behaviorOwner)&&pools.has(row.behaviorOwner));usedPools.add(row.behaviorOwner);
    }
    assert.equal(usedPools.size,pools.size);
    for(const [owner,pool]of pools) {
      assert(Array.isArray(pool.behaviors)&&pool.behaviors.length<=32);
      for(const [index,behavior]of pool.behaviors.entries()) {
        assert.equal(behavior.index,index);assert.deepEqual(behavior.source,{resource:owner,field:'Behaviors.'+index});
        assert(object(behavior.projectiles));
        for(const [field,binding]of Object.entries(behavior.projectiles)) {
          assert(['projectileType','chargedProjectileType'].includes(field));assert.equal(binding.referenceOwner,owner);
          assert.equal(binding.reference,behavior.fire?.values[field]);assert(shots.has(binding.uniqueName));
          const shot=shots.get(binding.uniqueName);expandAiProjectile(shot,profiles.get(shot.unknownFields),binding);
          bindings++;usedShots.add(binding.uniqueName);usedProfiles.add(shot.unknownFields);
        }
      }
    }
    assert.equal(usedShots.size,shots.size);assert.equal(usedProfiles.size,profiles.size);
    for(const [key,value]of Object.entries({inventoryItems:items.size,weapons:weapons.size,behaviorDeclarations:pools.size,
      projectileBindings:bindings,projectiles:shots.size,unknownFieldProfiles:profiles.size}))assert.equal(c[key],value,key);
  }
}
