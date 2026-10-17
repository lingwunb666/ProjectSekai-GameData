import assert from 'node:assert/strict';
const root='/Lotus/Scripts/Libs/';
const bodies=new Map([
  [root+'IntrinsicsSkillSymbolsLib.lua','809297dacc7f2841a325051b97dd9c527205114dce12872453fae6d39e08a263'],
  [root+'PlayerSkillsLib.lua','4fd5ebd57da3d00e8e350ab1d70c7173d39b1c03105dd265ae90491307a47684']
]);
const exact=(v,keys)=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...keys].sort());};
const integer=(v,min,max)=>Number.isInteger(v)&&v>=min&&v<=max;
const fields=new Set(['category','filter','operationType','upgradeObjectType','upgradeType','validPosture','validType','value']);
export class NativeIntrinsics {
  accept(path,envelope){
    if(!['exports/neutral/ExportClientIntrinsics.json','exports/neutral/ExportClientEnums.json'].includes(path))return;
    if(this.region===undefined)this.region=envelope.region;
    assert.equal(envelope.region,this.region);assert.equal(envelope.locale,'neutral');
    if(path.endsWith('/ExportClientIntrinsics.json')){
      assert(!this.data);exact(envelope.sections,['ClientIntrinsicTables']);
      assert(Array.isArray(envelope.sections.ClientIntrinsicTables)&&envelope.sections.ClientIntrinsicTables.length===1);
      this.data=envelope.sections.ClientIntrinsicTables[0];
    }else for(const row of envelope.sections.ClientEnums??[]){if(row.uniqueName==='PlayerSkill'){assert(!this.declaration);this.declaration=row;}}
  }
  verify(required=false){
    if(!this.data&&!required)return;
    const {data:d,declaration:e}=this;assert(d&&e,'complete intrinsic inputs');
    exact(d,['uniqueName','format','sources','enumSource','values']);
    assert.equal(d.uniqueName,root+'PlayerSkillsLib.lua');assert.equal(d.format,'client-intrinsic-tables-v1');
    assert.deepEqual(d.enumSource,e.source);assert(/^[a-f0-9]{64}$/.test(d.enumSource.clientArtifactSha256));
    assert(Array.isArray(d.sources)&&d.sources.length===2);const ids=new Set();
    for(const s of d.sources){assert(bodies.has(s.resource)&&!ids.has(s.resource));ids.add(s.resource);
      assert.equal(s.cache,'B.Font');assert.equal(s.decodedSha256,bodies.get(s.resource));assert(integer(s.bytes,1,16*1024*1024));
      for(const key of ['tocSha256','compressedSha256'])assert(/^[a-f0-9]{64}$/.test(s[key]));}
    const v=d.values;exact(v,['schema','maxRank','categories','symbols','branches','limits']);assert.equal(v.schema,d.format);assert.equal(v.maxRank,10);
    const categories=['ALL','CREWSHIP','PLAYER','ARCHWING','MECH','DRIFTER','OPERATOR','HORSE','DUVIRI_WF'];
    exact(v.categories,categories.map(c=>'CATEGORY_'+c));categories.forEach((c,i)=>assert.equal(v.categories['CATEGORY_'+c],i+1));
    assert(v.symbols&&typeof v.symbols==='object'&&!Array.isArray(v.symbols)&&Object.keys(v.symbols).length===50);const names=new Set();
    for(const [key,s]of Object.entries(v.symbols)){assert(/^sSkill[A-Za-z0-9]+$/.test(key));exact(s,['symbol']);assert(/^SKILL_[A-Z0-9_]+$/.test(s.symbol)&&!names.has(s.symbol));names.add(s.symbol);}
    assert(Array.isArray(e.values)&&e.values.length===10);const enums=new Map();
    for(const row of e.values){assert(integer(row.index,0,9)&&!enums.has(row.index));enums.set(row.index,row.name);}
    assert.equal(enums.get(0),'LPS_NONE');assert(Array.isArray(v.branches)&&v.branches.length===9);let effectCount=0;
    v.branches.forEach((b,i)=>{
      exact(b,['uniqueName','skillIndex','ranks']);assert.equal(b.skillIndex,i+1);assert.equal(b.uniqueName,enums.get(i+1));
      const first=i===1?0:1;assert(Array.isArray(b.ranks)&&b.ranks.length===11-first);
      b.ranks.forEach((r,j)=>{
        exact(r,['rank','upgrades']);assert.equal(r.rank,j+first);assert(Array.isArray(r.upgrades)&&r.upgrades.length<=16);
        for(const u of r.upgrades){
          assert(u&&typeof u==='object'&&!Array.isArray(u)&&Object.keys(u).every(f=>fields.has(f)));
          assert(Object.hasOwn(u,'upgradeType')!==Object.hasOwn(u,'upgradeObjectType'));effectCount++;
          for(const [key,value]of Object.entries(u)){
            if(key==='value')assert(Number.isFinite(value)&&value===Math.fround(value));
            else if(key==='category')assert(integer(value,1,9));
            else if(['upgradeType','operationType','validPosture'].includes(key))assert(integer(value,0,65535));
            else if(key==='filter'){exact(value,['symbol']);assert(names.has(value.symbol));}
            else if(Object.hasOwn(value,'nativeConstant')){exact(value,['nativeConstant']);assert.equal(key,'validType');assert.equal(value.nativeConstant,'0xa65682c8');}
            else{exact(value,['constructor','resource']);assert.equal(value.constructor,key==='validType'?'0x9466a60b':'0xa80e8a33');assert(/^\/Lotus\/[A-Za-z0-9_/]+$/.test(value.resource));}
          }
        }
      });
    });
    assert.equal(effectCount,104);assert(Array.isArray(v.limits)&&v.limits.length===3&&v.limits.every(s=>typeof s==='string'&&s.trim()));
  }
}
