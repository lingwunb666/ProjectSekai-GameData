import assert from 'node:assert/strict';

const text=x=>typeof x==='string'&&x.length>0&&x.length<=1024&&!/[\x00-\x1f]/.test(x);
const resource=x=>text(x)&&/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(x)&&x.split('/').every(p=>p!=='.'&&p!=='..');
const hash=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function reference(row) {
  assert(typeof row.rawTarget==='string','Text icon reference type');
  assert(row.rawTarget===''?row.status==='EMPTY_OVERRIDE':text(row.rawTarget)&&['RESOLVED','UNRESOLVED'].includes(row.status));
  assert(row.status==='RESOLVED'?resource(row.resourceTarget):row.resourceTarget===null,'Text icon reference target');
}
export class NativeTextIcons {
  #data; #coverage;
  accept(path,data) {
    if(path==='exports/neutral/ExportClientTextIcons.json')this.#data=data.sections;
    if(path==='exports/neutral/ExportClientTextIconCoverage.json')this.#coverage=data.sections?.ClientTextIconCoverage;
  }
  verify(declared) {
    assert.equal(declared,Boolean(this.#data&&this.#coverage),'Text icon capability/artifacts');
    if(!this.#data&&!this.#coverage)return;
    assert(this.#data&&this.#coverage,'Partial text icon artifacts');
    const collections=this.#data.ClientTextIconCollections,materials=this.#data.ClientTextIconMaterials;
    assert(Array.isArray(collections)&&collections.length===2&&Array.isArray(materials)&&materials.length<=4096);
    const selections=new Set(),wanted=new Set();let names=0,bindings=0;
    for(const row of collections) {
      assert(resource(row.uniqueName));assert.equal(row.familyRoot,'/EE/Types/GraphicsRes/PlatformIconCollection');
      const s=row.selection,owner=row.fieldSources?.Icons;
      assert(['IconCollection','EmoticonCollection'].includes(s?.field)&&!selections.has(s.field));selections.add(s.field);
      assert(resource(s.resource));reference(s);assert.equal(s.status,'RESOLVED');assert.equal(s.resourceTarget,row.uniqueName);
      assert(resource(owner?.resource));assert.equal(owner.field,'Icons');
      assert(Array.isArray(row.values?.Icons)&&row.values.Icons.length<=4096&&Array.isArray(row.bindings));
      const pending=new Map(),unique=new Set();
      row.values.Icons.forEach((icon,i)=>{
        assert(Array.isArray(icon.Platforms)&&icon.Platforms.length<=64);
        if(icon.Name===''&&!icon.Platforms.length)return;
        assert(text(icon.Name)&&!unique.has(icon.Name));unique.add(icon.Name);
        const platforms=new Set();
        icon.Platforms.forEach((p,j)=>{
          assert(typeof p.IconPlatform==='string'&&/^DIT_[A-Z0-9_]+$/.test(p.IconPlatform)&&!platforms.has(p.IconPlatform));
          platforms.add(p.IconPlatform);pending.set(`/values/Icons/${i}/Platforms/${j}/Material`,{p,name:icon.Name});
        });
      });
      for(const binding of row.bindings) {
        const expected=pending.get(binding.pointer);assert(expected,'Unknown/duplicate text icon binding');
        assert.equal(binding.name,expected.name);assert.equal(binding.platform,expected.p.IconPlatform);
        assert.equal(binding.owner,owner.resource);assert.equal(binding.rawTarget,expected.p.Material);reference(binding);
        if(binding.status==='RESOLVED')wanted.add(binding.resourceTarget);
        pending.delete(binding.pointer);
      }
      assert.equal(pending.size,0,'Missing text icon binding');names+=row.values.Icons.length;bindings+=row.bindings.length;
    }
    const seen=new Set();
    for(const row of materials) {
      assert(wanted.has(row.uniqueName)&&!seen.has(row.uniqueName),'Unexpected/duplicate icon material');seen.add(row.uniqueName);
      assert(Array.isArray(row.resourceChain)&&row.resourceChain.length>0&&row.resourceChain.length<=100);
      assert(row.resourceChain.every(resource)&&new Set(row.resourceChain).size===row.resourceChain.length);
      assert.equal(row.resourceChain[0],row.uniqueName);
      assert(Array.isArray(row.layers)&&Array.isArray(row.textureFields)&&typeof row.completeAttributeChain==='boolean');
      if(!['/EE/Types/GraphicsRes/Material','/EE/Types/GraphicsRes/ProceduralMaterial'].includes(row.resourceChain.at(-1))) {
        assert.equal(row.completeAttributeChain,false);assert.equal(row.layers.length,0);assert.equal(row.textureFields.length,0);continue;
      }
      assert.equal(row.layers.length,row.resourceChain.length,'Missing material layers');
      const expected=new Map();let complete=true;
      row.layers.forEach((layer,i)=>{
        assert.equal(layer.resource,row.resourceChain[i]);
        if(['MISSING_MATERIAL_ATTRIBUTES','UNMODELED_HEADER'].includes(layer.kind)) {
          assert.equal(layer.textureAttributes,null);complete=false;return;
        }
        assert(['PACKAGE_ATTRIBUTES','RESOURCE_HEADER_ATTRIBUTES','OPAQUE_NATIVE_CLASS_NO_DEFAULTS'].includes(layer.kind));
        assert(layer.textureAttributes&&typeof layer.textureAttributes==='object'&&!Array.isArray(layer.textureAttributes));
        if(layer.kind==='OPAQUE_NATIVE_CLASS_NO_DEFAULTS') {
          assert.equal(i,row.layers.length-1);assert.deepEqual(layer.textureAttributes,{});
        }
        if(layer.kind==='RESOURCE_HEADER_ATTRIBUTES') {
          assert.equal(layer.source?.resource,layer.resource);assert.equal(layer.source.cache,'H.Misc');
          assert(['tocSha256','compressedSha256','decodedSha256'].every(k=>hash(layer.source[k]))&&hash(layer.bodySha256));
          assert.equal(layer.bodyStatus,'NOT_INTERPRETED');
          assert(Number.isSafeInteger(layer.bodyOffset)&&layer.bodyOffset>=28&&Number.isSafeInteger(layer.bodyBytes)&&layer.bodyBytes>=0);
          assert.equal(layer.bodyOffset+layer.bodyBytes,layer.source.bytes);
        }
        for(const [field,raw]of Object.entries(layer.textureAttributes)) {
          assert(field.startsWith('TX:'),'Non-texture attribute');
          if(!expected.has(field))expected.set(field,{raw,owner:layer.resource});
        }
      });
      assert.equal(row.completeAttributeChain,complete);
      for(const value of row.textureFields) {
        const source=expected.get(value.field);assert(source,'Unexpected/duplicate texture field');
        assert.deepEqual(value.rawTarget,source.raw);assert.equal(value.owner,source.owner);
        if(typeof source.raw==='string')reference(value);
        else {assert.equal(value.status,'UNMODELED_TEXTURE_VALUE');assert.equal(value.resourceTarget,null);}
        assert(complete?!Object.hasOwn(value,'effectiveStatus'):value.effectiveStatus==='UNVERIFIED_INCOMPLETE_CHAIN','Unsafe parent fallback');
        if(value.inventory) {
          const p=value.inventory;assert.equal(value.status,'RESOLVED');assert.equal(p.resource,value.resourceTarget);
          assert.equal(p.cache,'H.Texture');assert(hash(p.tocSha256));assert.equal(p.status,'INDEX_ONLY_NOT_DECODED');
          assert(Number.isSafeInteger(p.bytes)&&p.bytes>=0&&Number.isSafeInteger(p.compressedBytes)&&p.compressedBytes>=0);
        }
        expected.delete(value.field);
      }
      assert.equal(expected.size,0,'Missing texture field');
    }
    assert.deepEqual(seen,wanted,'Missing icon material');
    const c=this.#coverage;assert.equal(c.schema,'client-text-icons-v1');
    assert.equal(c.collections,2);assert.equal(c.names,names);assert.equal(c.bindings,bindings);assert.equal(c.materials,seen.size);
  }
}
