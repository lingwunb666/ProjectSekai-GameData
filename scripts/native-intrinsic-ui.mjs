import assert from 'node:assert/strict';
const root='/Lotus/Interface/';
const scripts={Intrinsics:'683c05c5587c431b16b2b6445ce8dcd177dd6f554bb2907c199fe69691c5c4c3',
  DrifterIntrinsics:'c17e0559f16ddb1caa5f432f3efeb6e3838dba5d544b64edb2710b137e94d7f5'};
const exact=(v,keys)=>{assert(v&&typeof v==='object'&&!Array.isArray(v));assert.deepEqual(Object.keys(v).sort(),[...keys].sort());};
function source(s,id,cache,hash){assert(s&&s.resource===id&&s.cache===cache&&Number.isInteger(s.bytes)&&s.bytes>0&&s.bytes<=16*1024*1024);
  for(const key of ['tocSha256','compressedSha256','decodedSha256'])assert(/^[a-f0-9]{64}$/.test(s[key]));if(hash)assert.equal(s.decodedSha256,hash);}
function asset(value){assert(typeof value==='string'&&value&&!value.includes('..')&&!value.includes('\\'));return value.startsWith('/')?value:root+value;}
export class NativeIntrinsicUi {
  labels=new Map();
  accept(path,envelope){
    if(!['exports/neutral/ExportClientIntrinsicUi.json','exports/en/ExportClientIntrinsicLocalization.json','exports/zh/ExportClientIntrinsicLocalization.json','exports/neutral/ExportClientIntrinsics.json'].includes(path))return;
    if(this.region===undefined)this.region=envelope.region;assert.equal(this.region,envelope.region);assert.equal(path.split('/')[1],envelope.locale);
    if(path.endsWith('/ExportClientIntrinsicUi.json')){assert(!this.data);this.data=envelope.sections;}
    else if(path.endsWith('/ExportClientIntrinsics.json')){assert(!this.tables);this.tables=envelope.sections.ClientIntrinsicTables[0].values;}
    else{exact(envelope.sections,['ClientIntrinsicLocalization']);assert(!this.labels.has(envelope.locale));this.labels.set(envelope.locale,envelope.sections.ClientIntrinsicLocalization);}
  }
  verify(required=false){
    if(!required&&!this.data&&!this.labels.size)return;
    assert(this.data&&this.tables);assert.deepEqual([...this.labels.keys()].sort(),['en','zh']);
    exact(this.data,['ClientIntrinsicUiHeaders','ClientIntrinsicUi','ClientIntrinsicUiCoverage']);
    const {ClientIntrinsicUiHeaders:headers,ClientIntrinsicUi:rows,ClientIntrinsicUiCoverage:c}=this.data;
    assert(Array.isArray(headers)&&headers.length===2&&Array.isArray(rows)&&rows.length===9);
    const seen=new Set(),expected=new Set();let offset=0;
    for(const h of headers){
      exact(h,['uniqueName','format','source','scriptSource','sourcePaths','headerType','script','bodyStatus']);
      const kind=h.uniqueName.split('/').at(-1).replace('.swf','');assert(Object.hasOwn(scripts,kind)&&h.uniqueName===root+kind+'.swf'&&!seen.has(kind));seen.add(kind);
      assert.equal(h.format,'client-intrinsic-ui-header-v1');assert.equal(h.headerType,9);assert.equal(h.bodyStatus,'OPAQUE_RENDER_BODY_NOT_PROJECTED');
      assert(Array.isArray(h.sourcePaths)&&h.sourcePaths[0]===h.uniqueName);source(h.source,h.uniqueName,'H.AnimRetarget');source(h.scriptSource,root+kind+'.lua','B.Font',scripts[kind]);
      const s=h.script,count=kind==='Intrinsics'?5:4;assert(s&&s.Script===kind+'.lua'&&s.Function==='Update'&&s._skillPool===(count===5?'LPP_SPACE':'LPP_DRIFTER'));
      for(const key of ['_playerSkills','_names','_descriptions','_icons','_videos'])assert(Array.isArray(s[key])&&s[key].length===count);
      for(let i=0;i<count;i++){
        const id=s._playerSkills[i],row=rows[offset++];assert(!expected.has(id));expected.add(id);
        exact(row,['uniqueName','skillIndex','skillPool','uiOrder','nameTag','descriptionTag','icon','video','ranks']);
        const branch=this.tables.branches.find(b=>b.uniqueName===id);assert(branch);assert.equal(row.uniqueName,id);assert.equal(row.skillIndex,branch.skillIndex);
        assert.equal(row.skillPool,s._skillPool);assert.equal(row.uiOrder,i+1);assert.equal(row.nameTag,s._names[i]);assert.equal(row.descriptionTag,s._descriptions[i]);
        assert([row.nameTag,row.descriptionTag].every(t=>typeof t==='string'&&t.startsWith('/Lotus/Language/')));
        assert.equal(row.icon,asset(s._icons[i]));assert.equal(row.video,asset(s._videos[i]));assert(Array.isArray(row.ranks)&&row.ranks.length===10);
        row.ranks.forEach((r,n)=>{exact(r,['rank','nameTag','descriptionTag']);assert.equal(r.rank,n+1);assert.equal(r.nameTag,row.nameTag+'_'+(n+1));assert.equal(r.descriptionTag,row.nameTag+'Desc_'+(n+1));});
      }
    }
    assert.equal(c.schema,'client-intrinsic-ui-v1');assert.equal(c.rule,'reviewed-pc-intrinsic-tags-v1');assert.equal(c.branches,9);assert.equal(c.ranks,90);exact(c.localizations,['en','zh']);
    for(const [locale,labels]of this.labels){
      assert(Array.isArray(labels)&&labels.length===9);const ids=new Set();let missing=0;
      const label=v=>{assert(v===null||typeof v==='string');if(v===null)missing++;};
      for(const row of labels){exact(row,['uniqueName','name','description','ranks']);assert(expected.has(row.uniqueName)&&!ids.has(row.uniqueName));ids.add(row.uniqueName);
        label(row.name);label(row.description);assert(Array.isArray(row.ranks)&&row.ranks.length===10);
        row.ranks.forEach((r,n)=>{exact(r,['rank','name','descriptionTemplate']);assert.equal(r.rank,n+1);label(r.name);label(r.descriptionTemplate);});}
      assert.equal(c.localizations[locale].branches,9);assert.equal(c.localizations[locale].missing,missing);
    }
  }
}
