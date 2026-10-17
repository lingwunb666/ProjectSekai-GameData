import test from 'node:test';
import assert from 'node:assert/strict';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {unpackDictionary} from './dictionary-encoding.mjs';
test('public verifier expands exact text and rejects invalid hashes and multiple gzip streams',()=>{
  const entries={'/Empty':'','/Literal':'<b>中文 é</b>\n|COUNT|'},raw=Buffer.from(JSON.stringify(entries)),gzip=gzipSync(raw);
  const d={schema:'client-dictionary-v2',locale:'fr',entryCount:2,emptyCount:1,source:{cache:'H.Misc_fr'},
    encoding:'gzip-base64-json-v1',entriesBytes:raw.length,entriesSha256:createHash('sha256').update(raw).digest('hex'),entriesGzip:gzip.toString('base64')};
  assert.deepEqual(unpackDictionary(d).entries,entries);
  assert.throws(()=>unpackDictionary({...d,entriesBytes:48*1024*1024+1}));
  assert.throws(()=>unpackDictionary({...d,entriesSha256:'0'.repeat(64)}));
  assert.throws(()=>unpackDictionary({...d,entriesGzip:Buffer.concat([gzip,gzip]).toString('base64')}));
  const bad=Buffer.from(gzip);bad[bad.length-8]^=1;
  assert.throws(()=>unpackDictionary({...d,entriesGzip:bad.toString('base64')}));
});
