import assert from 'node:assert/strict';

const artifact='exports/neutral/ExportClientEnemyDropTables.json',schema='client-enemy-drop-tables-v1';
const categories=['DROP_AMMO','DROP_BLUEPRINT','DROP_MISC_ITEM','DROP_MOD','DROP_POWERUP','DROP_SIGIL','DROP_VOID_PROJECTION','DROP_FUSION_ORNAMENT'];
const array=(v,max)=>assert(Array.isArray(v)&&v.length<=max,'enemy drop array bound');
const text=v=>assert(typeof v==='string'&&v.length<=4096&&!v.includes('\0'),'enemy drop text');
const identity=v=>{text(v);assert(v.startsWith('/Lotus/')&&!v.includes('..')&&v.length<=1024,'enemy drop identity');};
const hash=v=>assert(typeof v==='string'&&/^[a-f0-9]{64}$/.test(v),'enemy drop hash');
const integer=(v,max)=>assert(Number.isSafeInteger(v)&&v>=0&&v<=max,'enemy drop integer');
const number=v=>assert(typeof v==='number'&&Number.isFinite(v)&&Math.fround(v)===v,'enemy drop binary32');
const bool=v=>assert.equal(typeof v,'boolean');
const vector=(v,n)=>{array(v,n);assert.equal(v.length,n);v.forEach(number);};
const rare=v=>{assert(v&&typeof v==='object');for(const k of ['rareBiasMin','rareBiasMax','rareAttenMin','rareAttenMax'])number(v[k]);vector(v.levelRange,2);};

/** Verifies native content and source provenance, not live final drop percentages. */
export class NativeEnemyDrops {
  accept(path,data) {
    if(path!==artifact)return;
    assert(!this.data,'duplicate enemy drop artifact');assert.equal(data.locale,'neutral');this.data=data;
  }
  verify(manifest) {
    if(!this.data&&!manifest.capabilities?.includes(schema))return;
    assert(this.data,'missing enemy drop artifact');assert.equal(this.data.region,manifest.region);
    const provenance=new Map();let visited=0;
    function collect(node,depth=0) {
      assert(node&&typeof node==='object'&&depth<=16&&++visited<=128,'source tree bound');
      const rows=node.clientExtraction?.sourceRecords??[];array(rows,16384);
      for(const row of rows)if(row.cache==='H.Misc') {
        if(provenance.has(row.resource))assert.deepEqual(provenance.get(row.resource),row,'conflicting source');
        provenance.set(row.resource,row);
      }
      const inputs=node.inputs??[];array(inputs,16);for(const input of inputs)collect(input,depth+1);
    }
    collect(manifest);
    const rows=this.data.sections?.ClientEnemyDropTableContents,c=this.data.sections?.ClientEnemyDropTableCoverage;
    array(rows,4096);const ids=new Set();let stripped=0,entries=0;
    for(const row of rows) {
      identity(row.uniqueName);assert(!ids.has(row.uniqueName));ids.add(row.uniqueName);
      assert.equal(row.familyRoot,'/Lotus/Types/Game/LotusDropTable');assert.equal(row.format,schema);
      assert.equal(row.exactEnd,true);assert.equal(row.exactBodyRoundTrip,true);hash(row.bodySha256);
      const source=row.source;assert.equal(source.resource,row.uniqueName);assert.equal(source.cache,'H.Misc');
      assert.deepEqual(source,provenance.get(row.uniqueName),'enemy drop acquisition');
      for(const k of ['tocSha256','compressedSha256','decodedSha256'])hash(source[k]);
      integer(source.bytes,16*1024*1024);assert(source.bytes>=49&&source.bytes%16===1);
      array(row.categories,8);assert.equal(row.categories.length,8);
      for(const [i,category]of row.categories.entries()) {
        assert.equal(category.category,categories[i]);bool(category.stripped);
        if(category.stripped){stripped++;assert.equal(category.body,null);continue;}
        const body=category.body;assert(body&&typeof body==='object');number(body.dropChance);integer(body.dropRateUpgrade,0xffffffff);
        if(body.dropRateUpgrade===0)assert.equal(body.dropRateUpgradeValidType,null);else text(body.dropRateUpgradeValidType);
        array(body.gearTables,1024);
        for(const table of body.gearTables) {
          bool(table.overrideLevelAdjustedBiasAtten);vector(table.levelRange,2);
          if(table.overrideLevelAdjustedBiasAtten){rare(table.rareBiasAtten);assert.deepEqual(table.levelRange,table.rareBiasAtten.levelRange);}
          else assert.equal(table.rareBiasAtten,null);
          array(table.gear,4096);entries+=table.gear.length;assert(entries<=500000);
          for(const item of table.gear) {
            assert(['ET_ENTITY','ET_ITEM','ET_STORE_ITEM'].includes(item.entryType));
            assert(['COMMON','UNCOMMON','RARE','LEGENDARY'].includes(item.rarity));text(item.target);number(item.bias);number(item.probability);
          }
        }
      }
      text(row.strippedItemType);bool(row.ignoreGameModeDrops);
      assert.deepEqual(Object.keys(row.defaultPickUps).sort(),[...categories].sort());
      assert.deepEqual(Object.keys(row.defaultRareBiasAtten).sort(),[...categories].sort());
      for(const category of categories){text(row.defaultPickUps[category]);rare(row.defaultRareBiasAtten[category]);}
      vector(row.spawnOffset,4);vector(row.upForce,2);vector(row.sideForce,2);
    }
    assert.equal(c.schema,schema);array(c.withoutResource,4096);
    for(const id of c.withoutResource){identity(id);assert(!ids.has(id));ids.add(id);}
    assert.equal(c.registered,ids.size);assert.equal(c.requested,rows.length);assert.equal(c.decoded,rows.length);
    assert.equal(c.strippedCategories,stripped);assert.equal(c.entries,entries);assert.deepEqual(c.issues,[]);
  }
}
