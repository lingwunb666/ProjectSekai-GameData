import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {crc32,deflateSync} from 'node:zlib';
import {packImageDistribution} from '../image-distribution.mjs';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export function fixture({complete=true}={}) {
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sekai-image-publish-test-'));
  const release=path.join(temporary,'source'),input=path.join(temporary,'distribution');
  fs.mkdirSync(path.join(release,'images'),{recursive:true});fs.mkdirSync(path.join(release,'metadata'));
  const chunk=(kind,payload)=>{const b=Buffer.alloc(payload.length+12);b.writeUInt32BE(payload.length);b.write(kind,4);
    payload.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;};
  const head=Buffer.alloc(13);head.writeUInt32BE(1);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;
  const png=Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),
    chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,128]))),chunk('IEND',Buffer.alloc(0))]);
  const file='images/'+hash(png)+'.png',id='/Lotus/Icon.png',digest='a'.repeat(64);
  const source=(resource,cache,bytes)=>({resource,cache,bytes,stamp:'1',tocSha256:digest,compressedSha256:digest,decodedSha256:digest});
  const manifest={schemaVersion:2,model:'regional-image-assets-v2',region:'china',clientArtifactSha256:digest,
    clientBuild:'packages-sha256-'+digest,packageSource:source('/Packages.bin','H.Misc',100),decoder:'Pillow/12.3.0',
    complete,requested:1,metadata:{},files:[{path:file,sha256:hash(png),bytes:png.length,width:1,height:1}]};
  const sections={bindings:[{kind:'ITEM_ICON',resource:'/Lotus/Item',owner:'/Lotus/Item',field:'Icon',
    rawTarget:id,resourceTarget:id,status:'RESOLVED'}],textIconCollections:[],
    textures:[{resource:id,header:{schema:'client-color-texture-v1',nativeType:163,format:10,width:1,height:1,
      headerBodySha256:digest,headerBodyBytes:12},headerSource:source(id,'H.Texture',40),bodySource:source(id,'B.Texture',4),
      mipLevels:[{width:1,height:1,bytes:4}],topOffset:0,image:file}],
    issues:complete?[]:[{kind:'ITEM',resource:'/Lotus/Unresolved',reason:'NO_EXPLICIT_ICON'}]};
  for(const [section,records] of Object.entries(sections)) {
    const bytes=Buffer.from(JSON.stringify({schemaVersion:1,region:'china',section,records})+'\n');
    const relative='metadata/'+section+'.json';fs.writeFileSync(path.join(release,relative),bytes);
    manifest.metadata[section]={path:relative,bytes:bytes.length,sha256:hash(bytes),records:records.length};
  }
  manifest.assetReleaseId='ga2-'+hash(Buffer.from(JSON.stringify(manifest))).slice(0,24);
  fs.writeFileSync(path.join(release,'manifest.json'),JSON.stringify(manifest));fs.writeFileSync(path.join(release,file),png);
  const result=packImageDistribution(release,input,{chunkBytes:3000});
  return {temporary,release,input,region:'china',indexSha256:result.indexSha256,commit:'b'.repeat(40),
    close(){const resolved=path.resolve(temporary);assert(path.dirname(resolved)===path.resolve(os.tmpdir())
      &&path.basename(resolved).startsWith('sekai-image-publish-test-'));fs.rmSync(resolved,{recursive:true,force:true});}};
}
