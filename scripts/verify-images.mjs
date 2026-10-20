// Independent verification of regional PNG packs; no collector imports, credentials or network.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {crc32,inflateSync} from 'node:zlib';

const hash=b=>createHash('sha256').update(b).digest('hex');
const digest=x=>typeof x==='string'&&/^[0-9a-f]{64}$/.test(x);
// Only PNG structural validation is memoized, never file reads/hashes or source provenance.
// Repeat distribution/publication checks still read each file and prove identical bytes.
// No PNG buffers or persistent cache survive here; callers cannot seed this private map.
const verifiedPngShapes=new Map(),MAX_VERIFIED_PNG_SHAPES=32768;
const resource=x=>typeof x==='string'&&/^\/(?:[A-Za-z0-9_.'-]+\/)*[A-Za-z0-9_.'-]+$/.test(x)
  &&x.split('/').every(p=>p!=='.'&&p!=='..');
function read(file,max) {
  const stat=fs.lstatSync(file);assert(stat.isFile()&&!stat.isSymbolicLink()&&stat.size>0&&stat.size<=max,'unsafe asset file');
  const bytes=fs.readFileSync(file);assert(bytes.length<=max,'asset changed size');return bytes;
}
function publicData(value) {
  if(Array.isArray(value))value.forEach(publicData);
  else if(value&&typeof value==='object')for(const [key,item]of Object.entries(value)) {
    assert(!/^(password|passwd|appsecret|apikey|accesstoken|clientsecret|authorization|cookie|privatekey)$/.test(key.replace(/[_-]/g,'').toLowerCase()),'private field');
    publicData(item);
  }else if(typeof value==='string')assert(!/PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|[A-Za-z]:[\\/](?:Users|dev|ProjectSekaiAcceptance)[\\/]|(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\//.test(value),'private value');
}
function provenance(record,id,cache) {
  assert(record&&record.resource===id&&record.cache===cache,'asset source identity');
  for(const key of ['tocSha256','compressedSha256','decodedSha256'])assert(digest(record[key]),'asset source hash');
  assert(Number.isSafeInteger(record.bytes)&&record.bytes>0&&record.bytes<=128*1024*1024,'asset source bytes');
  assert(typeof record.stamp==='string'&&/^[1-9][0-9]{0,18}$/.test(record.stamp),'asset source stamp');
}
export function verifyPng(bytes,width,height) {
  assert(Number.isInteger(width)&&Number.isInteger(height)&&width>0&&height>0&&width<=4096&&height<=4096&&width*height<=4*1024*1024,'PNG pixel bounds');
  assert(bytes.subarray(0,8).equals(Buffer.from('89504e470d0a1a0a','hex')),'PNG signature');
  let at=8,header=false,ended=false;const compressed=[];
  while(at<bytes.length) {
    assert(!ended&&at+12<=bytes.length,'PNG framing');
    const size=bytes.readUInt32BE(at),kind=bytes.toString('ascii',at+4,at+8);
    assert(size<=20*1024*1024&&at+12+size<=bytes.length,'PNG chunk bound');
    assert.equal(crc32(bytes.subarray(at+4,at+8+size)),bytes.readUInt32BE(at+8+size),'PNG CRC');
    const payload=bytes.subarray(at+8,at+8+size);
    if(kind==='IHDR') {
      assert(!header&&at===8&&size===13,'PNG header');header=true;
      assert(payload.readUInt32BE(0)===width&&payload.readUInt32BE(4)===height
        &&payload.subarray(8).equals(Buffer.from([8,6,0,0,0])),'PNG RGBA dimensions/encoding');
    }else if(kind==='IDAT') {assert(header,'PNG data before header');compressed.push(payload);}
    else if(kind==='IEND') {assert(header&&size===0&&compressed.length,'PNG end');ended=true;}
    else assert.fail('unexpected PNG chunk');
    at+=12+size;
  }
  assert(ended,'missing PNG end');
  const stride=width*4+1,encoded=Buffer.concat(compressed);
  const inflated=inflateSync(encoded,{maxOutputLength:stride*height,info:true}),raw=inflated.buffer;
  assert.equal(inflated.engine.bytesWritten,encoded.length,'unused PNG compressed data');
  assert.equal(raw.length,stride*height,'PNG scanline length');
  for(let row=0;row<height;row++)assert(raw[row*stride]<=4,'PNG filter');
}
export function verifyImagePack(directory,expected={}) {
  const root=path.resolve(directory),stat=fs.lstatSync(root);
  assert(stat.isDirectory()&&!stat.isSymbolicLink(),'unsafe asset directory');
  const manifestBytes=read(path.join(root,'manifest.json'),64*1024*1024),manifest=JSON.parse(manifestBytes);
  publicData(manifest);assert([1,2].includes(manifest.schemaVersion)&&manifest.model==='regional-image-assets-v'+manifest.schemaVersion,'image schema');
  const identity={...manifest};delete identity.assetReleaseId;
  assert.equal(manifest.assetReleaseId,'ga'+manifest.schemaVersion+'-'+hash(Buffer.from(JSON.stringify(identity))).slice(0,24),'image release identity');
  const m={...manifest};
  if(m.schemaVersion===2) {
    assert(manifestBytes.length<=8*1024*1024,'image manifest bound');
    const sections=['bindings','issues','textIconCollections','textures'];
    assert.deepEqual(Object.keys(m.metadata).sort(),sections,'metadata sections');let bytesTotal=0;
    const metadataRoot=path.join(root,'metadata'),metadataStat=fs.lstatSync(metadataRoot);
    assert(metadataStat.isDirectory()&&!metadataStat.isSymbolicLink(),'unsafe metadata directory');
    for(const section of sections) {
      const ref=m.metadata[section];assert(ref.path==='metadata/'+section+'.json','metadata path');
      const bytes=read(path.join(root,ref.path),48*1024*1024);bytesTotal+=bytes.length;
      assert(bytesTotal<=128*1024*1024&&bytes.length===ref.bytes&&digest(ref.sha256)&&hash(bytes)===ref.sha256,'metadata integrity');
      const data=JSON.parse(bytes);publicData(data);
      assert(data.schemaVersion===1&&data.region===m.region&&data.section===section&&Array.isArray(data.records)
        &&data.records.length===ref.records,'metadata context/count');m[section]=data.records;
    }
    assert.deepEqual(fs.readdirSync(metadataRoot).sort(),sections.map(x=>x+'.json'),'extra metadata files');
  }
  assert(['china','international'].includes(m.region)&&digest(m.clientArtifactSha256),'image region/client');
  for(const key of ['region','clientBuild','clientArtifactSha256'])if(expected[key])assert.equal(m[key],expected[key],'catalog/image generation mismatch');
  assert(m.clientBuild==='packages-sha256-'+m.packageSource.decodedSha256,'package generation');
  provenance(m.packageSource,'/Packages.bin','H.Misc');
  assert.equal(m.decoder,'Pillow/12.3.0','image decoder');
  assert(Array.isArray(m.bindings)&&m.bindings.length<=100000&&Array.isArray(m.issues)&&m.issues.length<=100000,'image binding bounds');
  assert(Array.isArray(m.textures)&&m.textures.length<=32768&&Array.isArray(m.files)&&m.files.length<=32768,'image file bounds');
  const targets=new Set(),iconKeys=new Set();
  for(const b of m.bindings) {
    assert(resource(b.resource)&&resource(b.owner)&&['ITEM_ICON','STORE_ICON','TEXT_ICON_DIFFUSE','DECLARED_TEXTURE'].includes(b.kind),'image binding');
    assert(['RESOLVED','EMPTY_OVERRIDE','UNRESOLVED'].includes(b.status),'image binding status');
    if(b.kind==='ITEM_ICON'||b.kind==='STORE_ICON') {
      const key=b.kind+':'+b.resource;
      assert(!iconKeys.has(key),'duplicate item/store icon binding');iconKeys.add(key);
      assert(b.field==='Icon'&&typeof b.rawTarget==='string','item/store icon field');
      assert((b.status==='EMPTY_OVERRIDE')===(b.rawTarget===''),'item/store empty icon override');
      if(Object.hasOwn(b,'itemTarget'))assert(b.kind==='ITEM_ICON'?b.itemTarget===b.resource:
        b.itemTarget===null||resource(b.itemTarget),'image item identity');
    }
    if(b.status==='RESOLVED') {assert(resource(b.resourceTarget),'image target');targets.add(b.resourceTarget);}
    else assert(b.resourceTarget===null,'nonresolved image target');
  }
  assert.equal(m.requested,targets.size,'requested image count');
  const used=new Map(),seen=new Set(),toc=new Map();
  for(const t of m.textures) {
    assert(targets.has(t.resource)&&!seen.has(t.resource),'unexpected/duplicate texture');seen.add(t.resource);
    const h=t.header;assert(['client-color-texture-v1','client-color-texture-v2'].includes(h.schema)
      &&h.nativeType===163&&[0,1,2,3,7,10,34].includes(h.format),'texture header');
    assert(Number.isInteger(h.width)&&Number.isInteger(h.height)&&h.width>0&&h.width<=4096&&h.height>0&&h.height<=4096&&h.width*h.height<=4*1024*1024,'texture dimensions');
    provenance(t.headerSource,t.resource,'H.Texture');
    assert(['B.Texture','F.Texture'].includes(t.bodySource.cache),'texture body cache');provenance(t.bodySource,t.resource,t.bodySource.cache);
    for(const s of [t.headerSource,t.bodySource]) {
      if(toc.has(s.cache))assert.equal(toc.get(s.cache),s.tocSha256,'mixed texture generations');else toc.set(s.cache,s.tocSha256);
    }
    assert(digest(h.headerBodySha256)&&Number.isSafeInteger(h.headerBodyBytes)&&h.headerBodyBytes>=12,'texture header evidence');
    assert(Array.isArray(t.mipLevels)&&t.mipLevels.length>0
      &&t.mipLevels.length<=1+Math.floor(Math.log2(Math.max(h.width,h.height))),'texture mip count');
    if(h.schema==='client-color-texture-v2') {
      assert(Number.isInteger(h.originalWidth)&&Number.isInteger(h.originalHeight)&&h.originalWidth>0&&h.originalHeight>0
        &&h.originalWidth<=65535&&h.originalHeight<=65535&&Number.isInteger(h.storedResolutionLimit)
        &&h.storedResolutionLimit>0&&h.storedResolutionLimit<=16384
        &&(h.storedResolutionLimit&(h.storedResolutionLimit-1))===0,'native resolution fields');
      let w=h.originalWidth,v=h.originalHeight;while(Math.max(w,v)>h.storedResolutionLimit){w=Math.max(1,w>>1);v=Math.max(1,v>>1);}
      assert(w===h.width&&v===h.height,'stored image resolution');
      assert(Number.isInteger(h.baseMipCount)&&Number.isInteger(h.fullMipCount)&&h.baseMipCount>=0&&h.fullMipCount>=0
        &&h.baseMipCount+h.fullMipCount>0&&h.baseMipCount+h.fullMipCount<=1+Math.floor(Math.log2(Math.max(w,v)))
        &&h.dimensionArrayCount===Math.max(0,h.fullMipCount-1),'native mip inventory');
      assert(h.baseMipCount===0?h.baseWidth===0&&h.baseHeight===0:
        h.baseWidth===Math.max(1,w>>h.fullMipCount)&&h.baseHeight===Math.max(1,v>>h.fullMipCount),'native base dimensions');
      assert(t.mipLevels.length===(t.bodySource.cache==='F.Texture'?h.fullMipCount:h.baseMipCount),'native selected mip count');
    }
    let width=h.width,height=h.height,total=0;
    for(const level of t.mipLevels) {
      const size=h.format===10?width*height*4:Math.ceil(width/4)*Math.ceil(height/4)*(h.format===0||h.format===1?8:16);
      assert(level.width===width&&level.height===height&&level.bytes===size,'texture mip layout');total+=size;
      width=Math.max(1,width>>1);height=Math.max(1,height>>1);
    }
    assert(total===t.bodySource.bytes&&t.topOffset===total-t.mipLevels[0].bytes,'texture mip/body size');
    assert(/^images\/[0-9a-f]{64}\.png$/.test(t.image),'image path');
    if(used.has(t.image))assert.deepEqual(used.get(t.image),[h.width,h.height],'deduplicated dimensions');
    else used.set(t.image,[h.width,h.height]);
  }
  const missing=new Set(m.issues.filter(x=>x.kind==='TEXTURE'&&x.reason==='UNMODELED_TEXTURE').map(x=>x.resource));
  for(const target of targets)assert(seen.has(target)||missing.has(target),'silently missing texture');
  assert.equal(m.complete,m.issues.length===0&&seen.size===targets.size,'image completeness');
  const imagesRoot=path.join(root,'images'),imageStat=fs.lstatSync(imagesRoot);assert(imageStat.isDirectory()&&!imageStat.isSymbolicLink());
  let total=0;const fileNames=new Set();
  for(const f of m.files) {
    assert(used.has(f.path)&&!fileNames.has(f.path)&&f.path==='images/'+f.sha256+'.png'&&digest(f.sha256),'image file identity');
    fileNames.add(f.path);assert.deepEqual([f.width,f.height],used.get(f.path),'image dimensions');
    const bytes=read(path.join(root,f.path),20*1024*1024);assert(bytes.length===f.bytes&&hash(bytes)===f.sha256,'image bytes/hash');
    total+=bytes.length;assert(total<=4*1024*1024*1024,'image pack bound');
    const shape=f.width+'x'+f.height+':'+bytes.length;
    if(verifiedPngShapes.get(f.sha256)!==shape) {
      verifyPng(bytes,f.width,f.height);
      if(verifiedPngShapes.size>=MAX_VERIFIED_PNG_SHAPES)verifiedPngShapes.delete(verifiedPngShapes.keys().next().value);
      verifiedPngShapes.set(f.sha256,shape);
    }
  }
  assert.equal(fileNames.size,used.size,'unlisted image');
  assert.deepEqual(fs.readdirSync(root).sort(),m.schemaVersion===2?['images','manifest.json','metadata']:['images','manifest.json'],'extra asset files');
  assert.deepEqual(fs.readdirSync(imagesRoot).sort(),[...fileNames].map(x=>x.slice(7)).sort(),'extra PNG files');
  return {region:m.region,assetReleaseId:m.assetReleaseId,manifestSha256:hash(manifestBytes),requested:m.requested,
    decoded:m.textures.length,images:m.files.length,bytes:total,issues:m.issues.length,complete:m.complete};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  assert(process.argv.length===4&&process.argv[2]==='--release','usage: node verify-images.mjs --release <asset pack>');
  console.log(JSON.stringify(verifyImagePack(process.argv[3])));
}
