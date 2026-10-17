import assert from 'node:assert/strict';
const exact=(value,fields)=>assert(value&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).sort().join('|')===[...fields].sort().join('|'),'official dictionary fields');
const hash=value=>assert(typeof value==='string'&&/^[a-f0-9]{64}$/.test(value),'official dictionary hash');
const integer=(value,min,max)=>assert(Number.isSafeInteger(value)&&value>=min&&value<=max,'official dictionary bound');
export function verifyOfficialDictionary(region,locale,source) {
  if(!Object.hasOwn(source,'distribution'))return;
  assert(!['en','zh'].includes(locale),'cannot replace base dictionaries');
  const d=source.distribution;
  exact(d,['schema','region','policy','index','metadataSha256','officialExeMd5','toc','cache',
    'tocDownloadSha256','cacheDownloadSha256','decodedCacheSha256']);
  assert(d.schema==='official-client-dictionary-v1'&&d.region===region&&d.policy==='EXACT_TAG_TEXT_ONLY_INDEPENDENT_VERSION','official dictionary scope');
  const origin={international:'https://content.warframe.com',china:'https://content-zhpt.wf.qq.com'}[region];
  exact(d.index,['url','sha256','bytes']);
  assert(origin&&d.index.url===origin+'/origin/3A2F77FB/index.txt.lzma','official dictionary regional origin');
  hash(d.index.sha256);integer(d.index.bytes,1,65536);
  for(const key of ['metadataSha256','tocDownloadSha256','cacheDownloadSha256','decodedCacheSha256'])hash(d[key]);
  assert(typeof d.officialExeMd5==='string'&&/^[A-F0-9]{32}$/.test(d.officialExeMd5),'official dictionary distribution version');
  for(const kind of ['toc','cache']) {
    const file=d[kind],resource='/Cache.Windows/H.Misc_'+locale+'.'+kind;
    exact(file,['resource','path','md5','encoding','downloadBytes']);
    assert(typeof file.md5==='string'&&/^[A-F0-9]{32}$/.test(file.md5)&&file.resource===resource
      &&file.path===resource+'.'+file.md5+'.lzma'&&file.encoding==='lzma','official dictionary exact language resource');
    integer(file.downloadBytes,1,8*1024*1024);
  }
}
