import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeDictionaries} from './native-dictionaries.mjs';
function data(locale,region='china') {
  return {schemaVersion:1,region,locale,sections:{ClientDictionary:{schema:'client-dictionary-v1',locale,
    entryCount:2,emptyCount:1,entries:{'/Unreferenced':'<b>文字</b>\n[RETRANSLATE]','/Empty':''},
    source:{cache:'H.Misc_'+locale,resource:'/Languages.bin',bytes:300,stamp:'1',tocSha256:'a'.repeat(64),
      compressedSha256:'b'.repeat(64),decodedSha256:'c'.repeat(64),checks:{formatVersion:44,exactEof:true,records:2,uniqueLabels:2}}}}};
}
test('full regional dictionaries preserve strings and validate installed-locale completeness independently',()=>{
  const v=new NativeDictionaries();v.verify();v.accept('exports/zh/ExportClientDictionary.json',data('zh'));
  assert.throws(()=>v.verify(),/complete installed/);v.accept('exports/en/ExportClientDictionary.json',data('en'));v.verify(true);
  assert.throws(()=>v.accept('exports/en/ExportClientDictionary.json',data('en')),/duplicate/);
  const wrong=data('en');wrong.sections.ClientDictionary.source.cache='H.Misc_zh';
  assert.throws(()=>new NativeDictionaries().accept('exports/en/ExportClientDictionary.json',wrong),/provenance/);
  const truncated=data('en');delete truncated.sections.ClientDictionary.entries['/Empty'];
  assert.throws(()=>new NativeDictionaries().accept('exports/en/ExportClientDictionary.json',truncated),/count/);
  const mixed=new NativeDictionaries();mixed.accept('exports/zh/ExportClientDictionary.json',data('zh'));
  assert.throws(()=>mixed.accept('exports/en/ExportClientDictionary.json',data('en','international')),/isolation/);
});
