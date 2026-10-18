import assert from 'node:assert/strict';

const resource=id=>typeof id==='string'&&id.length<=512&&/^\/(Lotus|EE)\/(?:[A-Za-z0-9_.'-]+\/)*[A-Za-z0-9_.'-]+$/.test(id)
  &&id.split('/').every(p=>p!=='.'&&p!=='..');
function chain(row) {
  const c=row.resourceChain;assert(Array.isArray(c)&&c.length>0&&c.length<=100&&c[0]===row.uniqueName,'Railjack chain');
  assert(c.every(resource)&&new Set(c).size===c.length,'Railjack chain identity');return new Set(c);
}
function fields(values,owners,ancestors,prefix='') {
  assert(values&&typeof values==='object'&&!Array.isArray(values)&&Object.keys(values).length<=128
    &&owners&&typeof owners==='object'&&!Array.isArray(owners)&&Object.keys(owners).length<=256,'Railjack fields');
  for(const [name,value]of Object.entries(values)) {
    if(name==='sourceFormat')continue;const owner=owners[prefix+name];
    assert(value===null?owner===null:owner&&ancestors.has(owner.resource)&&owner.field===prefix+name,'Railjack field owner');
  }
}
export function verifyRailjack(data) {
  const rows=data.sections?.ClientRailjackWeapons;if(rows===undefined)return;
  const coverage=data.sections.ClientCatalogFamilyCoverage;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length>0&&rows.length<=512,'Railjack inventory');
  assert(coverage?.schema==='native-railjack-weapon-sources-v1'&&coverage.weapons===rows.length
    &&Array.isArray(coverage.issues)&&coverage.issues.length===0,'Railjack coverage');
  const seen=new Set();
  for(const row of rows) {
    assert(row.schema==='native-railjack-weapon-source-v1'&&row.productCategory==='CrewShipWeapons'&&!seen.has(row.uniqueName),'Railjack schema');seen.add(row.uniqueName);
    const ancestry=chain(row);assert(ancestry.has('/Lotus/Weapons/CrewShip/RailjackWeapon'),'Railjack family');
    fields(row.values,row.fieldSources,ancestry);
    assert(Array.isArray(row.behaviors)&&row.behaviors.length<=32,'Railjack behaviors');
    for(const [i,b]of row.behaviors.entries()) {
      assert(b.index===i&&ancestry.has(b.source?.resource)&&b.source.field==='Behaviors.'+i,'Railjack behavior owner');
      assert(b.projectiles&&typeof b.projectiles==='object'&&!Array.isArray(b.projectiles)&&Object.keys(b.projectiles).length<=4,'Railjack projectiles');
      for(const shot of Object.values(b.projectiles)) {
        const parents=chain(shot);assert(shot.schema==='native-projectile-facts-v2'&&shot.referenceOwner===b.source.resource,'Railjack projectile scope');
        fields(shot.values,shot.fieldSources,parents);
        assert(shot.attacks&&typeof shot.attacks==='object'&&!Array.isArray(shot.attacks)&&Object.keys(shot.attacks).length<=8,'Railjack attack map');
        for(const [key,attack]of Object.entries(shot.attacks))fields(attack,shot.fieldSources,parents,key+'.');
      }
    }
  }
}
