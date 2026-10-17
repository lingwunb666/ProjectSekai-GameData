import assert from 'node:assert/strict';
export class NativeItemParents {
  rows=new Map();labels=new Map();identities=new Set();coverage=null;files=new Set();
  accept(path,data) {
    if(!path.startsWith('exports/'))return;
    const locale=data.locale;
    for(const [kind,value]of Object.entries(data.sections??{})) {
      if(kind==='ClientItemIdentities')for(const row of value)this.identities.add(row.uniqueName);
      if(kind==='ClientItemParentCoverage'){assert(!this.coverage&&locale==='neutral');this.coverage=value;this.files.add(path);}
      if(!['ClientItemParents','ClientItemParentLocalization'].includes(kind))continue;
      assert(Array.isArray(value)&&(kind==='ClientItemParents')===(locale==='neutral'));
      if(kind!=='ClientItemParents'&&!this.labels.has(locale))this.labels.set(locale,new Map());
      const rows=kind==='ClientItemParents'?this.rows:this.labels.get(locale);
      for(const row of value){assert(!rows.has(row.uniqueName));rows.set(row.uniqueName,row);}this.files.add(path);
    }
  }
  verify(required=false) {
    if(!required&&!this.rows.size&&!this.labels.size&&!this.coverage)return;
    assert(this.rows.size>0&&this.rows.size<=16384&&this.labels.has('en')&&this.labels.has('zh'));
    for(const f of ['neutral/ExportClientItemParents','en/ExportClientItemParents','zh/ExportClientItemParents','neutral/ExportClientItemParentCoverage'])
      assert(this.files.has('exports/'+f+'.json'),'Missing item-parent capability file');
    assert.equal(this.coverage?.schema,'client-item-parents-v1');assert.equal(this.coverage.parents,this.rows.size);
    assert.equal(this.coverage.seedItems,this.identities.size);
    for(const [id,row]of this.rows) {
      assert(typeof id==='string'&&/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(id));
      assert.equal(row.selectionRule,'explicit-item-ancestry-v1');assert.equal(typeof row.parentName,'string');
      assert.equal(typeof row.rawParent,'string');assert.equal(row.isStoreItemIdentity,this.identities.has(id));
      assert(row.values&&row.fieldSources);const chain=new Set();let current=id;
      while(current!=='') {
        assert(this.rows.has(current)&&!chain.has(current)&&chain.size<100,'Incomplete/cyclic item-parent graph');
        chain.add(current);current=this.rows.get(current).parentName;assert.equal(typeof current,'string');
      }
      for(const [field,value]of Object.entries(row.values)) {
        const source=row.fieldSources[field];if(source===null&&value===null)continue;
        assert(chain.has(source?.resource)&&source.field===field,'Item-parent field owner');
        assert.deepEqual(this.rows.get(source.resource).values[field],value);
        assert.deepEqual(this.rows.get(source.resource).fieldSources[field],source);
      }
    }
    for(const labels of this.labels.values()) {
      assert.deepEqual(new Set(labels.keys()),new Set(this.rows.keys()));
      for(const [id,label]of labels)for(const [field,tag]of [['name','LocalizeTag'],['description','LocalizeDescTag']]) {
        assert(label[field]===null||typeof label[field]==='string');
        assert.deepEqual(label[field+'Tag'],this.rows.get(id).values[tag]);
      }
    }
  }
}
