import assert from 'node:assert/strict';
import {inflateRawSync,crc32} from 'node:zlib';
import {createHash} from 'node:crypto';
const MAX_RAW=48*1024*1024,MAX_GZIP=16*1024*1024;
const sha=b=>createHash('sha256').update(b).digest('hex');
export function unpackDictionary(dictionary) {
  if(dictionary.schema!=='client-dictionary-v2')return dictionary;
  assert.deepEqual(Object.keys(dictionary).sort(),['schema','locale','entryCount','emptyCount','source','encoding','entriesBytes','entriesSha256','entriesGzip'].sort(),'dictionary encoding fields');
  assert(dictionary.encoding==='gzip-base64-json-v1'&&!Object.hasOwn(dictionary,'entries'),'dictionary encoding');
  assert(Number.isSafeInteger(dictionary.entriesBytes)&&dictionary.entriesBytes>0&&dictionary.entriesBytes<=MAX_RAW,'dictionary expanded bound');
  assert(typeof dictionary.entriesSha256==='string'&&/^[a-f0-9]{64}$/.test(dictionary.entriesSha256),'dictionary expanded hash');
  const value=dictionary.entriesGzip;
  assert(typeof value==='string'&&value.length<=Math.ceil(MAX_GZIP/3)*4&&/^[A-Za-z0-9+/]*={0,2}$/.test(value),'dictionary base64 bound');
  const compressed=Buffer.from(value,'base64');assert(compressed.toString('base64')===value&&compressed.length>=18&&compressed.length<=MAX_GZIP,'canonical dictionary base64');
  assert(compressed.readUInt16LE(0)===0x8b1f&&compressed[2]===8&&compressed[3]===0,'dictionary gzip header');
  const deflated=compressed.subarray(10,-8),result=inflateRawSync(deflated,{maxOutputLength:dictionary.entriesBytes+1,info:true});
  const raw=result.buffer;
  assert(result.engine.bytesWritten===deflated.length,'dictionary gzip trailing or concatenated streams');
  assert(raw.length===dictionary.entriesBytes&&compressed.readUInt32LE(compressed.length-4)===raw.length&&sha(raw)===dictionary.entriesSha256,'dictionary expanded integrity');
  assert(crc32(raw)===compressed.readUInt32LE(compressed.length-8),'dictionary gzip CRC');
  const entries=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(raw));
  assert(entries&&typeof entries==='object'&&!Array.isArray(entries),'dictionary entries object');
  const {encoding,entriesBytes,entriesSha256,entriesGzip,...metadata}=dictionary;
  return {...metadata,schema:'client-dictionary-v1',entries};
}
