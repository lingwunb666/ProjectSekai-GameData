import assert from 'node:assert/strict';

/** Independent cross-file check, not just a checksum of a collector-created identity claim. */
export class NativeIdentities {
  #expected=new Map();
  #anchors=new Map();
  #present=false;
  #invalidEvidence=false;
  accept(data) {
    for(const [section,rows]of Object.entries(data.sections??{})) {
      if(section.startsWith('ClientInventory')&&Array.isArray(rows)) for(const row of rows) {
        assert(typeof row.uniqueName==='string'&&row.uniqueName.startsWith('/Lotus/StoreItems/'));
        assert(typeof row.typeName==='string'&&row.typeName.startsWith('/'));
        if(row.values?.TypeName!==row.typeName || typeof row.fieldSources?.TypeName!=='string'
          || !row.fieldSources.TypeName.startsWith('/'))this.#invalidEvidence=true;
        if(!this.#expected.has(row.typeName))this.#expected.set(row.typeName,new Set());
        this.#expected.get(row.typeName).add(row.uniqueName);
      }
      if(section==='ClientItemIdentities') {
        this.#present=true;
        assert.equal(data.locale,'neutral','Identity anchors must be language-neutral');
        assert(Array.isArray(rows));
        for(const row of rows) {
          assert.equal(row.identityRule,'explicit-store-typename-v1');
          assert(typeof row.uniqueName==='string'&&row.uniqueName.startsWith('/')&&!this.#anchors.has(row.uniqueName));
          assert(Array.isArray(row.storeItems)&&row.storeItems.length>0);
          assert(row.storeItems.every(s=>typeof s==='string'&&s.startsWith('/Lotus/StoreItems/')));
          assert.equal(new Set(row.storeItems).size,row.storeItems.length,'Duplicate anchor stores');
          this.#anchors.set(row.uniqueName,new Set(row.storeItems));
        }
      }
    }
  }
  verify() {
    if(!this.#present)return new Set();
    assert(!this.#invalidEvidence,'Store identity lacks explicit native TypeName evidence');
    assert.equal(this.#anchors.size,this.#expected.size,'Incomplete identity anchor inventory');
    for(const [id,stores]of this.#anchors)assert.deepEqual(stores,this.#expected.get(id),'Identity anchor TypeName membership');
    return new Set(this.#anchors.keys());
  }
}
