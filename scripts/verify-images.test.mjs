import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {crc32,deflateSync} from 'node:zlib';
import {verifyPng,verifyImagePack} from './verify-images.mjs';
import {packImageDistribution,restoreImageDistribution} from './image-distribution.mjs';
import {fixture as imageFixture} from './test-fixtures/image-pack.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function png() {
  const chunk=(kind,payload)=>{const b=Buffer.alloc(payload.length+12);b.writeUInt32BE(payload.length);b.write(kind,4);payload.copy(b,8);b.writeUInt32BE(crc32(b.subarray(4,-4)),b.length-4);return b;};
  const head=Buffer.alloc(13);head.writeUInt32BE(1);head.writeUInt32BE(1,4);head[8]=8;head[9]=6;
  return Buffer.concat([Buffer.from('89504e470d0a1a0a','hex'),chunk('IHDR',head),
    chunk('IDAT',deflateSync(Buffer.from([0,255,0,0,128]))),chunk('IEND',Buffer.alloc(0))]);
}
test('PNG independently checks CRC, exact dimensions, inflation and EOF',()=>{
  const bytes=png();verifyPng(bytes,1,1);assert.throws(()=>verifyPng(bytes,2,1),/dimensions/);
  const corrupt=Buffer.from(bytes);corrupt[45]^=1;assert.throws(()=>verifyPng(corrupt,1,1),/CRC/);
  assert.throws(()=>verifyPng(Buffer.concat([bytes,Buffer.from([0])]),1,1),/framing/);
});
test('repeat PNG validation never skips rereading and hashing the file',()=>{
  const f=imageFixture();
  try {
    const first=verifyImagePack(f.release);assert.deepEqual(verifyImagePack(f.release),first);
    const m=JSON.parse(fs.readFileSync(path.join(f.release,'manifest.json')));
    const file=path.join(f.release,m.files[0].path),stat=fs.statSync(file),bytes=fs.readFileSync(file);
    bytes[bytes.length-1]^=1;fs.writeFileSync(file,bytes);fs.utimesSync(file,stat.atime,stat.mtime);
    assert.throws(()=>verifyImagePack(f.release),/hash/);
  } finally {f.close();}
});

test('sealed v2 image packs reject ambiguous and incoherent item/store icons',()=>{
  const f=imageFixture();
  try {
    const base=JSON.parse(fs.readFileSync(path.join(f.release,'manifest.json')));
    const binding=JSON.parse(fs.readFileSync(path.join(f.release,'metadata/bindings.json'))).records[0];
    function seal(rows) {
      const m=structuredClone(base);delete m.assetReleaseId;
      const bytes=Buffer.from(JSON.stringify({schemaVersion:1,region:'china',section:'bindings',records:rows})+'\n');
      fs.writeFileSync(path.join(f.release,'metadata/bindings.json'),bytes);
      Object.assign(m.metadata.bindings,{bytes:bytes.length,sha256:hash(bytes),records:rows.length});
      m.assetReleaseId='ga2-'+hash(Buffer.from(JSON.stringify(m))).slice(0,24);
      fs.writeFileSync(path.join(f.release,'manifest.json'),JSON.stringify(m));
    }
    for(const kind of ['ITEM_ICON','STORE_ICON'])for(const conflict of [false,true]) {
      const row={...binding,kind},second={...row,...(conflict?{status:'EMPTY_OVERRIDE',rawTarget:'',resourceTarget:null}:{})};
      seal([row,second]);assert.throws(()=>verifyImagePack(f.release),/duplicate item\/store icon binding/);
    }
    for(const patch of [{field:'TipIcon'},{itemTarget:'/Lotus/Other'},{itemTarget:3},{rawTarget:3},{rawTarget:''},
      {status:'EMPTY_OVERRIDE',resourceTarget:null},{status:'UNRESOLVED',rawTarget:'',resourceTarget:null},
      {kind:'STORE_ICON',itemTarget:'../Other'}]) {
      seal([{...binding,...patch}]);assert.throws(()=>verifyImagePack(f.release),/item\/store|image item identity/);
    }
    // The same item may have distinct store art, declared illustrations and repeated foil variants.
    for(const status of ['EMPTY_OVERRIDE','UNRESOLVED']) {
      seal([{...binding,status,rawTarget:status==='EMPTY_OVERRIDE'?'':'Unavailable.png',resourceTarget:null,itemTarget:binding.resource},
        {...binding,kind:'STORE_ICON',resource:'/Lotus/StoreItems/Item',itemTarget:binding.resource},
        {...binding,kind:'DECLARED_TEXTURE'}, {...binding,kind:'DECLARED_TEXTURE'}]);
      assert.equal(verifyImagePack(f.release).images,1);
    }
    seal([{...binding,itemTarget:binding.resource}]);assert.equal(verifyImagePack(f.release).images,1);
  }finally{f.close();}
});
test('asset pack verifies image closure, content identity and rejects region/generation mixing',()=>{
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'sekai-image-pack-test-'));
  const root=path.join(temporary,'source');fs.mkdirSync(root);fs.mkdirSync(path.join(root,'images'));
  const bytes=png(),file='images/'+hash(bytes)+'.png',id='/Lotus/Icon.png',digest='a'.repeat(64);
  const source=(resource,cache,bytes)=>({resource,cache,bytes,stamp:'1',tocSha256:digest,compressedSha256:digest,decodedSha256:digest});
  const m={schemaVersion:1,model:'regional-image-assets-v1',region:'china',clientArtifactSha256:digest,
    clientBuild:'packages-sha256-'+digest,packageSource:source('/Packages.bin','H.Misc',100),decoder:'Pillow/12.3.0',
    complete:true,requested:1,bindings:[{kind:'ITEM_ICON',resource:'/Lotus/Item',owner:'/Lotus/Item',
      field:'Icon',rawTarget:id,resourceTarget:id,status:'RESOLVED'}],textIconCollections:[],
    textures:[{resource:id,header:{schema:'client-color-texture-v1',nativeType:163,format:10,width:1,height:1,
      headerBodySha256:digest,headerBodyBytes:12},headerSource:source(id,'H.Texture',40),bodySource:source(id,'B.Texture',4),
      mipLevels:[{width:1,height:1,bytes:4}],topOffset:0,image:file}],files:[{path:file,sha256:hash(bytes),bytes:bytes.length,width:1,height:1}],issues:[]};
  m.assetReleaseId='ga1-'+hash(Buffer.from(JSON.stringify(m))).slice(0,24);
  fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(m));fs.writeFileSync(path.join(root,file),bytes);
  try {
    assert.equal(verifyImagePack(root,{region:'china',clientBuild:m.clientBuild}).images,1);
    assert.throws(()=>verifyImagePack(root,{region:'international'}),/generation mismatch/);
    assert.throws(()=>verifyImagePack(root,{clientArtifactSha256:'b'.repeat(64)}),/generation mismatch/);
    const bc5=structuredClone(m);delete bc5.assetReleaseId;
    bc5.textures[0].header.format=7;bc5.textures[0].bodySource.bytes=16;bc5.textures[0].mipLevels[0].bytes=16;
    bc5.assetReleaseId='ga1-'+hash(Buffer.from(JSON.stringify(bc5))).slice(0,24);
    fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(bc5));
    assert.equal(verifyImagePack(root).decoded,1,'BC5 has 16 bytes even for a sub-block image');
    const unknown=structuredClone(bc5);delete unknown.assetReleaseId;unknown.textures[0].header.format=35;
    unknown.assetReleaseId='ga1-'+hash(Buffer.from(JSON.stringify(unknown))).slice(0,24);
    fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(unknown));
    assert.throws(()=>verifyImagePack(root),/texture header/);
    // Independent v2 fixture construction; no producer functions or imports are used here.
    const v2={...m,schemaVersion:2,model:'regional-image-assets-v2',metadata:{}};delete v2.assetReleaseId;
    fs.mkdirSync(path.join(root,'metadata'));
    for(const section of ['bindings','issues','textIconCollections','textures']) {
      const shard=Buffer.from(JSON.stringify({schemaVersion:1,region:'china',section,records:m[section]})+'\n');
      const relative='metadata/'+section+'.json';fs.writeFileSync(path.join(root,relative),shard);
      v2.metadata[section]={path:relative,bytes:shard.length,sha256:hash(shard),records:m[section].length};delete v2[section];
    }
    v2.assetReleaseId='ga2-'+hash(Buffer.from(JSON.stringify(v2))).slice(0,24);
    fs.writeFileSync(path.join(root,'manifest.json'),JSON.stringify(v2));
    assert.equal(verifyImagePack(root).images,1);
    const distribution=path.join(temporary,'distribution'),restored=path.join(temporary,'restored');
    const packaged=packImageDistribution(root,distribution,{chunkBytes:3000});
    assert(packaged.chunks>=2,'fixture exercises multiple chunks');
    const pin={region:'china',indexSha256:packaged.indexSha256};
    assert.equal(restoreImageDistribution(distribution,restored,pin).manifestSha256,hash(fs.readFileSync(path.join(root,'manifest.json'))));
    assert(fs.readFileSync(path.join(restored,file)).equals(bytes));
    assert.throws(()=>restoreImageDistribution(distribution,restored,pin),/NEW directory/);
    assert.throws(()=>restoreImageDistribution(distribution,path.join(temporary,'bad-region'),{...pin,region:'international'}),/identity/);
    assert.throws(()=>restoreImageDistribution(distribution,path.join(temporary,'bad-pin'),{...pin,indexSha256:'0'.repeat(64)}),/hash mismatch/);
    const index=JSON.parse(fs.readFileSync(path.join(distribution,'distribution.json'))),chunkPath=path.join(distribution,index.chunks[0].path);
    const broken=fs.readFileSync(chunkPath);broken[0]^=1;fs.writeFileSync(chunkPath,broken);
    assert.throws(()=>restoreImageDistribution(distribution,path.join(temporary,'bad-chunk'),pin),/integrity mismatch/);
    fs.writeFileSync(path.join(root,'images','extra.png'),bytes);
    assert.throws(()=>verifyImagePack(root),/extra PNG/);
  } finally {
    // Only the unique directory created above is owned by this test.
    assert(path.dirname(path.resolve(temporary))===path.resolve(os.tmpdir())
      &&path.basename(temporary).startsWith('sekai-image-pack-test-')
      &&fs.lstatSync(temporary).isDirectory()&&!fs.lstatSync(temporary).isSymbolicLink());
    fs.rmSync(temporary,{recursive:true,force:false});
  }
});
