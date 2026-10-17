import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyOfficialDictionary} from './official-dictionary-source.mjs';
function source(region='international',locale='fr') {
  const d={schema:'official-client-dictionary-v1',region,policy:'EXACT_TAG_TEXT_ONLY_INDEPENDENT_VERSION',
    index:{url:({international:'https://content.warframe.com',china:'https://content-zhpt.wf.qq.com'})[region]+'/origin/3A2F77FB/index.txt.lzma',
      sha256:'a'.repeat(64),bytes:1000},metadataSha256:'b'.repeat(64),officialExeMd5:'C'.repeat(32),
    tocDownloadSha256:'d'.repeat(64),cacheDownloadSha256:'e'.repeat(64),decodedCacheSha256:'f'.repeat(64)};
  for(const kind of ['toc','cache']) {
    const resource='/Cache.Windows/H.Misc_'+locale+'.'+kind;
    d[kind]={resource,path:resource+'.'+'A'.repeat(32)+'.lzma',md5:'A'.repeat(32),encoding:'lzma',downloadBytes:1000};
  }
  return {distribution:d};
}
test('independent official text has explicit region/version and cannot overwrite base language',()=>{
  verifyOfficialDictionary('international','fr',source());verifyOfficialDictionary('china','fr',source('china'));
  assert.throws(()=>verifyOfficialDictionary('china','fr',source()));
  assert.throws(()=>verifyOfficialDictionary('international','en',source('international','en')));
  for(const mutate of [d=>d.index.url='https://example.com/index',d=>d.cache.path+='?latest',d=>d.policy='GAMEPLAY',
    d=>d.toc.resource='/Cache.Windows/H.Misc_de.toc',d=>d.metadataSha256='latest',d=>d.sameVersion=true]) {
    const s=source();mutate(s.distribution);assert.throws(()=>verifyOfficialDictionary('international','fr',s));
  }
});
