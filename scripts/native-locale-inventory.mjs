import assert from 'node:assert/strict';
const locales=['en','zh','de','es','fr','it','ja','ko','pl','pt','ru','tc','th','tr','uk'];
const exact=(value,keys)=>assert(value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join('|')===[...keys].sort().join('|'),'locale inventory fields');
const integer=(value,min,max)=>assert(Number.isSafeInteger(value)&&value>=min&&value<=max,'locale inventory integer');
export function verifyLocaleInventory(manifest,dictionaries=new Map()) {
  const found=[];let visited=0;
  function collect(node,depth=0){
    assert(node&&typeof node==='object'&&!Array.isArray(node)&&depth<=16&&++visited<=128,'locale provenance bounds');
    if(Object.hasOwn(node.clientExtraction??{},'localeInventory'))found.push(node.clientExtraction.localeInventory);
    if(Object.hasOwn(node,'inputs')){assert(Array.isArray(node.inputs)&&node.inputs.length<=16);node.inputs.forEach(input=>collect(input,depth+1));}
  }
  collect(manifest);if(!found.length)return {};
  const inventory=found[0];found.forEach(row=>assert.deepEqual(row,inventory,'conflicting locale inventories'));
  exact(inventory,['schema','scope','observedFiles','locales']);
  assert(inventory.schema==='client-locale-inventory-v1'&&inventory.scope==='LOCAL_INSTALLATION_AT_CAPTURE','locale scope');
  assert(Array.isArray(inventory.observedFiles)&&inventory.observedFiles.length<=128,'locale file list');
  const files=new Set();for(const file of inventory.observedFiles){
    assert(typeof file==='string'&&/^H\.Misc_[a-z]{2}\.(toc|cache)$/.test(file)&&!files.has(file),'locale filename');files.add(file);
  }
  assert(Array.isArray(inventory.locales)&&inventory.locales.length===locales.length,'locale coverage');
  const result={};
  for(let i=0;i<locales.length;i++){
    const locale=locales[i],row=inventory.locales[i],cache='H.Misc_'+locale;
    exact(row,['locale','cache','state','evidence']);assert(row.locale===locale&&row.cache===cache,'locale identity/order');
    const toc=files.has(cache+'.toc'),data=files.has(cache+'.cache'),source=dictionaries.get(locale),e=row.evidence;let expected;
    if(!toc||!data){assert(e===null&&!source,'absent cache with dictionary');expected=toc===data?'NOT_INSTALLED':'INCOMPLETE_CACHE_PAIR';}
    else {
      exact(e,['tocSha256','cacheBytes','resource']);assert(typeof e.tocSha256==='string'&&/^[a-f0-9]{64}$/.test(e.tocSha256));
      integer(e.cacheBytes,0,64*1024*1024*1024);
      if(e.resource===null){assert(!source,'absent language resource with dictionary');expected='RESOURCE_ABSENT';}
      else {
        const r=e.resource;exact(r,['stamp','bytes','compressedBytes']);
        assert(typeof r.stamp==='string'&&/^[1-9][0-9]{0,18}$/.test(r.stamp),'locale resource stamp');
        integer(r.bytes,1,128*1024*1024);integer(r.compressedBytes,1,128*1024*1024);assert(r.compressedBytes<=e.cacheBytes);
        expected=source?'DECODED':'INSTALLED_NOT_DECODED';
        if(source)assert(source.cache===cache&&source.resource==='/Languages.bin'&&source.tocSha256===e.tocSha256
          &&source.bytes===r.bytes&&source.stamp===r.stamp,'locale dictionary acquisition mismatch');
      }
    }
    assert.equal(row.state,expected,'locale observation state');result[locale]=expected;
  }
  return result;
}
