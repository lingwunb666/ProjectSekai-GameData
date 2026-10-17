import assert from 'node:assert/strict';
import {verifyLocaleInventory,EXPECTED_LOCALES} from './native-locale-inventory.mjs';
import {unpackDictionary} from './dictionary-encoding.mjs';
import {verifyOfficialDictionary} from './official-dictionary-source.mjs';

export class NativeDictionaries {
  locales=new Set(); region; sources=new Map();
  accept(path,envelope) {
    if(!path.endsWith('/ExportClientDictionary.json'))return;
    const {locale,region,sections}=envelope;
    assert(EXPECTED_LOCALES.includes(locale)&&['china','international'].includes(region)&&envelope.schemaVersion===1
      &&path===`exports/${locale}/ExportClientDictionary.json`,'dictionary envelope');
    if(this.region===undefined)this.region=region;assert.equal(this.region,region,'dictionary regional isolation');
    assert(!this.locales.has(locale),'duplicate dictionary locale');
    assert.deepEqual(Object.keys(sections),['ClientDictionary']);const d=unpackDictionary(sections.ClientDictionary);
    assert(d.schema==='client-dictionary-v1'&&d.locale===locale&&d.entries&&typeof d.entries==='object'
      &&!Array.isArray(d.entries),'dictionary schema');
    const entries=Object.entries(d.entries),s=d.source,c=s?.checks;
    assert(entries.length>0&&entries.length<=250000&&d.entryCount===entries.length,'dictionary count');
    assert(s?.resource==='/Languages.bin'&&s.cache==='H.Misc_'+locale&&Number.isSafeInteger(s.bytes)
      &&s.bytes>0&&s.bytes<=128*1024*1024&&typeof s.stamp==='string'&&/^[1-9][0-9]{0,18}$/.test(s.stamp),'dictionary provenance');
    for(const field of ['tocSha256','compressedSha256','decodedSha256'])assert(typeof s[field]==='string'&&/^[a-f0-9]{64}$/.test(s[field]),'dictionary hash');
    assert(c?.exactEof===true&&c.formatVersion===44&&c.records===entries.length&&c.uniqueLabels===entries.length,'dictionary source coverage');
    let empty=0;
    for(const [key,value]of entries) {
      assert(key.startsWith('/')&&key.length<=1024&&!/[\x00-\x1f]/.test(key)&&typeof value==='string'&&value.length<=65536,'dictionary literal');
      if(value==='')empty++;
    }
    verifyOfficialDictionary(region,locale,s);
    assert.equal(d.emptyCount,empty,'dictionary empty-string preservation');this.locales.add(locale);this.sources.set(locale,s);
  }
  verify(required=false,manifest) {
    if(required||this.locales.size)assert(['en','zh'].every(locale=>this.locales.has(locale)),'complete installed dictionary locales');
    if(manifest)verifyLocaleInventory(manifest,this.sources);
  }
}
