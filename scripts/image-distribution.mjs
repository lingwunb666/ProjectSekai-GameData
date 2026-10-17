// Offline Release-attachment preparation/restoration. No uploads, credentials, game files or live activation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyImagePack} from './verify-images.mjs';

const CHUNK_BYTES=256*1024*1024,MAX_FILE=48*1024*1024,MAX_TOTAL=4*1024**3+136*1024**2;
const digest=x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
const hash=b=>createHash('sha256').update(b).digest('hex');
const dataPath=x=>typeof x==='string'&&/^(manifest\.json|metadata\/(bindings|textures|issues|textIconCollections)\.json|images\/[a-f0-9]{64}\.png)$/.test(x);
function noLinks(file) {
  for(let p=path.resolve(file);;p=path.dirname(p)) {
    if(fs.existsSync(p))assert(!fs.lstatSync(p).isSymbolicLink(),'linked distribution paths are forbidden');
    if(path.dirname(p)===p)break;
  }
}
function boundedRead(file,max) {
  noLinks(file);const stat=fs.lstatSync(file);assert(stat.isFile()&&stat.size>0&&stat.size<=max,'distribution file bounds');
  const bytes=fs.readFileSync(file);assert(bytes.length<=max,'distribution file grew');return bytes;
}
function newOutput(input,output) {
  const source=path.resolve(input),target=path.resolve(output);noLinks(source);noLinks(target);
  const relative=path.relative(source,target);
  assert(relative&&(relative.startsWith('..'+path.sep)||path.isAbsolute(relative)),'output cannot be inside input');
  assert(!fs.existsSync(target),'output must be a NEW directory');fs.mkdirSync(target,{recursive:true});return target;
}
function writeAll(fd,bytes) {let at=0;while(at<bytes.length){const n=fs.writeSync(fd,bytes,at,bytes.length-at);assert(n>0,'short distribution write');at+=n;}}
function chunkHash(file) {
  noLinks(file);const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),h=createHash('sha256');
  try {let size=0,n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){size+=n;assert(size<=CHUNK_BYTES,'chunk too large');h.update(buffer.subarray(0,n));}return {bytes:size,sha256:h.digest('hex')};}
  finally {fs.closeSync(fd);}
}

/** Concatenated exact file bytes, no compression/re-encoding. Each file is wholly within one bounded chunk. */
export function packImageDistribution(release,output,{chunkBytes=CHUNK_BYTES,indexOnly=false,checkStorage=()=>{}}={}) {
  assert(Number.isSafeInteger(chunkBytes)&&chunkBytes>=128&&chunkBytes<=CHUNK_BYTES,'chunk size bound');
  const accepted=verifyImagePack(release),manifestBytes=boundedRead(path.join(release,'manifest.json'),8*1024*1024);
  assert.equal(hash(manifestBytes),accepted.manifestSha256,'manifest changed after validation');
  const m=JSON.parse(manifestBytes);assert.equal(m.schemaVersion,2,'distribution requires image pack v2');
  const inventory=[{path:'manifest.json',bytes:manifestBytes.length,sha256:accepted.manifestSha256},
    ...Object.values(m.metadata),...m.files].sort((a,b)=>a.path.localeCompare(b.path,'en'));
  const root=newOutput(release,output),chunks=[],files=[];let fd,chunk,chunkDigest;
  const close=()=>{if(chunk===undefined)return;if(fd!==undefined)fs.closeSync(fd);fd=undefined;
    chunk.sha256=chunkDigest.digest('hex');chunks.push(chunk);chunk=undefined;};
  try {
    for(const f of inventory) {
      assert(dataPath(f.path),'invalid asset inventory path');
      const bytes=boundedRead(path.join(release,f.path),MAX_FILE);
      assert(bytes.length===f.bytes&&hash(bytes)===f.sha256&&bytes.length<=chunkBytes,'changed/oversized asset');
      if(chunk===undefined||chunk.bytes+bytes.length>chunkBytes) {
        close();chunk={path:`images-${accepted.region}-${accepted.assetReleaseId}-${String(chunks.length).padStart(3,'0')}.bin`,bytes:0};
        if(!indexOnly)fd=fs.openSync(path.join(root,chunk.path),'wx');chunkDigest=createHash('sha256');
      }
      files.push({path:f.path,bytes:bytes.length,sha256:f.sha256,chunk:chunks.length,offset:chunk.bytes});
      if(!indexOnly){checkStorage(bytes.length);writeAll(fd,bytes);}chunkDigest.update(bytes);chunk.bytes+=bytes.length;
    }
    close();
  }finally {if(fd!==undefined)fs.closeSync(fd);}
  const index={schemaVersion:1,model:'regional-image-distribution-v1',region:accepted.region,
    assetReleaseId:accepted.assetReleaseId,manifestSha256:accepted.manifestSha256,clientBuild:m.clientBuild,
    clientArtifactSha256:m.clientArtifactSha256,complete:accepted.complete,chunks,files};
  index.distributionId='gad1-'+hash(Buffer.from(JSON.stringify(index))).slice(0,24);
  const bytes=Buffer.from(JSON.stringify(index)+'\n');assert(bytes.length<=8*1024*1024,'distribution index bound');
  checkStorage(bytes.length);fs.writeFileSync(path.join(root,'distribution.json'),bytes,{flag:'wx'});
  return {region:index.region,assetReleaseId:index.assetReleaseId,distributionId:index.distributionId,
    indexSha256:hash(bytes),chunks:chunks.length,bytes:chunks.reduce((n,c)=>n+c.bytes,0),complete:index.complete};
}

/** Shared bounded parser: downloads validate the pinned inventory before requesting any chunks. */
export function parseImageDistributionIndex(bytes,{region,indexSha256}) {
  assert(['china','international'].includes(region)&&digest(indexSha256),'explicit distribution region/digest pin required');
  assert(Buffer.isBuffer(bytes)&&bytes.length>0&&bytes.length<=8*1024*1024,'distribution index bounds');
  assert.equal(hash(bytes),indexSha256,'distribution index hash mismatch');
  const d=JSON.parse(bytes),identity={...d};delete identity.distributionId;
  assert(d.schemaVersion===1&&d.model==='regional-image-distribution-v1'&&d.region===region
    &&/^ga2-[a-f0-9]{24}$/.test(d.assetReleaseId)&&digest(d.manifestSha256)
    &&typeof d.complete==='boolean'&&/^packages-sha256-[a-f0-9]{64}$/.test(d.clientBuild)
    &&digest(d.clientArtifactSha256),'distribution identity');
  assert.equal(d.distributionId,'gad1-'+hash(Buffer.from(JSON.stringify(identity))).slice(0,24),'distribution content identity');
  assert(Array.isArray(d.chunks)&&d.chunks.length>0&&d.chunks.length<=32773
    &&Array.isArray(d.files)&&d.files.length>=5&&d.files.length<=32773,'distribution inventory bounds');
  const totals=d.chunks.map(()=>0),chunkFiles=d.chunks.map(()=>[]),seen=new Set();let total=0;
  d.chunks.forEach((c,i)=>{
    assert(c.path===`images-${region}-${d.assetReleaseId}-${String(i).padStart(3,'0')}.bin`
      &&digest(c.sha256)&&Number.isSafeInteger(c.bytes)&&c.bytes>0&&c.bytes<=CHUNK_BYTES,'invalid chunk inventory');
    total+=c.bytes;assert(total<=MAX_TOTAL,'distribution byte bound');
  });
  for(const f of d.files) {
    assert(dataPath(f.path)&&!seen.has(f.path)&&digest(f.sha256)&&Number.isSafeInteger(f.bytes)&&f.bytes>0&&f.bytes<=MAX_FILE
      &&Number.isSafeInteger(f.chunk)&&f.chunk>=0&&f.chunk<d.chunks.length&&Number.isSafeInteger(f.offset)
      &&f.offset===totals[f.chunk],'invalid/noncontiguous distribution file');
    seen.add(f.path);totals[f.chunk]+=f.bytes;chunkFiles[f.chunk].push(f);
  }
  totals.forEach((n,i)=>assert.equal(n,d.chunks[i].bytes,'unindexed chunk bytes'));
  assert(seen.has('manifest.json')&&[...seen].filter(x=>x.startsWith('metadata/')).length===4,'missing metadata inventory');
  return {index:d,bytes,chunkFiles};
}

/** Validate the closed distribution layout before reading any chunk or creating an output. */
function distributionIndex(input,pin) {
  const parsed=parseImageDistributionIndex(boundedRead(path.join(input,'distribution.json'),8*1024*1024),pin);
  assert.deepEqual(fs.readdirSync(input).sort(),['distribution.json',...parsed.index.chunks.map(x=>x.path)].sort(),'extra distribution files');
  return parsed;
}

function plannedIndex(input,pin) {
  const parsed=parseImageDistributionIndex(boundedRead(path.join(input,'distribution.json'),8*1024*1024),pin);
  assert.deepEqual(fs.readdirSync(input),['distribution.json'],
    'index-only directory must contain only distribution.json; active/stale uploads require inspection, not automatic removal');
  return parsed;
}

// Read exact indexed source files in bounded buffers. Also used for virtual chunks: no packed copy required.
function sourceChunk(release,chunk,files,outputFd) {
  const buffer=Buffer.alloc(1024*1024),whole=createHash('sha256');let total=0;
  for(const f of files) {
    const file=path.join(release,f.path);noLinks(file);const stat=fs.lstatSync(file);
    assert(stat.isFile()&&stat.size===f.bytes,'source file size mismatch');
    const fd=fs.openSync(file,'r'),content=createHash('sha256');let left=f.bytes;
    try {
      while(left>0) {
        const n=fs.readSync(fd,buffer,0,Math.min(left,buffer.length),null);assert(n>0,'truncated source file');
        const bytes=buffer.subarray(0,n);content.update(bytes);whole.update(bytes);left-=n;total+=n;
        if(outputFd!==undefined)writeAll(outputFd,bytes);
      }
      assert.equal(fs.readSync(fd,buffer,0,1,null),0,'source file grew');
      assert.equal(content.digest('hex'),f.sha256,'source file integrity mismatch');
    }finally{fs.closeSync(fd);}
  }
  assert.equal(total,chunk.bytes,'projected chunk size mismatch');
  assert.equal(whole.digest('hex'),chunk.sha256,'projected chunk integrity mismatch');
}

/** Verify an explicit index-only plan against source bytes; publication additionally checks the full PNG pack. */
export function verifyImageDistributionPlan(release,input,pin) {
  const {index,bytes,chunkFiles}=plannedIndex(input,pin);
  index.chunks.forEach((chunk,i)=>sourceChunk(release,chunk,chunkFiles[i]));
  return {index,indexSha256:hash(bytes),indexBytes:bytes.length};
}

/** Exclusive single-chunk lease, under the plan directory, never system TEMP. No recursive/stale cleanup. */
export async function withImageDistributionChunk(release,input,pin,name,consume,{checkStorage=()=>{}}={}) {
  const {index,chunkFiles}=plannedIndex(input,pin),ordinal=index.chunks.findIndex(c=>c.path===name);
  assert(ordinal>=0,'chunk is not in pinned inventory');
  const chunk=index.chunks[ordinal],directory=path.resolve(input,'.upload');
  noLinks(directory);fs.mkdirSync(directory);const owner=fs.lstatSync(directory,{bigint:true});
  const file=path.join(directory,chunk.path);let fd,stamp;
  const sameIdentity=(a,b)=>a.dev===b.dev&&a.ino===b.ino;
  try {
    checkStorage(chunk.bytes); // Reserve room BEFORE any bytes are written.
    fd=fs.openSync(file,'wx');
    try{sourceChunk(release,chunk,chunkFiles[ordinal],fd);}
    finally{stamp=fs.fstatSync(fd,{bigint:true});fs.closeSync(fd);fd=undefined;}
    checkStorage(0);
    return await consume(file);
  } finally {
    if(fd!==undefined)fs.closeSync(fd);
    noLinks(directory);const current=fs.lstatSync(directory,{bigint:true});
    assert(current.isDirectory()&&sameIdentity(current,owner),'upload directory ownership changed; retained for inspection');
    if(stamp) {
      noLinks(file);const currentFile=fs.lstatSync(file,{bigint:true});
      assert(currentFile.isFile()&&sameIdentity(currentFile,stamp)&&currentFile.size===stamp.size
        &&currentFile.mtimeNs===stamp.mtimeNs&&currentFile.ctimeNs===stamp.ctimeNs,
      'upload file changed; retained for inspection');
      fs.unlinkSync(file);
    }
    // rmdir fails, preserving any unexpected file. Never delete anything this lease did not create.
    fs.rmdirSync(directory);checkStorage(0);
  }
}

/** One bounded streaming pass, without restoring several gigabytes just to verify publication inputs. */
export function verifyImageDistribution(input,pin) {
  const {index,bytes,chunkFiles}=distributionIndex(input,pin),buffer=Buffer.alloc(1024*1024);
  index.chunks.forEach((chunk,i)=>{
    const file=path.join(input,chunk.path);noLinks(file);const stat=fs.lstatSync(file);
    assert(stat.isFile()&&stat.size===chunk.bytes,'chunk size mismatch');
    const fd=fs.openSync(file,'r'),whole=createHash('sha256');
    try {
      for(const f of chunkFiles[i]) {
        let left=f.bytes;const content=createHash('sha256');
        while(left>0) {
          const n=fs.readSync(fd,buffer,0,Math.min(left,buffer.length),null);assert(n>0,'truncated chunk');
          const slice=buffer.subarray(0,n);content.update(slice);whole.update(slice);left-=n;
        }
        assert.equal(content.digest('hex'),f.sha256,'distribution file integrity mismatch');
      }
      assert.equal(fs.readSync(fd,buffer,0,1,null),0,'chunk grew beyond inventory');
      assert.equal(whole.digest('hex'),chunk.sha256,'chunk integrity mismatch');
    }finally{fs.closeSync(fd);}
  });
  return {index,indexSha256:hash(bytes),indexBytes:bytes.length};
}

/** Caller supplies a separately trusted index digest and region; returned directory has passed full PNG verification. */
export function restoreImageDistribution(input,output,pin) {
  const {index:d,chunkFiles}=distributionIndex(input,pin),{region}=pin;
  const root=newOutput(input,output);fs.mkdirSync(path.join(root,'metadata'));fs.mkdirSync(path.join(root,'images'));
  for(let i=0;i<d.chunks.length;i++) {
    const chunk=d.chunks[i],file=path.join(input,chunk.path),stat=fs.lstatSync(file);noLinks(file);
    assert(stat.isFile()&&stat.size===chunk.bytes,'chunk size mismatch');
    assert.deepEqual(chunkHash(file),{bytes:chunk.bytes,sha256:chunk.sha256},'chunk integrity mismatch');
    const fd=fs.openSync(file,'r');
    try {
      for(const f of chunkFiles[i]) {
        const bytes=Buffer.alloc(f.bytes);let at=0;
        while(at<bytes.length){const n=fs.readSync(fd,bytes,at,bytes.length-at,f.offset+at);assert(n>0,'truncated chunk');at+=n;}
        assert.equal(hash(bytes),f.sha256,'restored file hash mismatch');
        fs.writeFileSync(path.join(root,f.path),bytes,{flag:'wx'});
      }
    }finally {fs.closeSync(fd);}
  }
  const result=verifyImagePack(root,{region,clientBuild:d.clientBuild,clientArtifactSha256:d.clientArtifactSha256});
  assert.equal(result.manifestSha256,d.manifestSha256,'restored manifest mismatch');
  assert.equal(result.assetReleaseId,d.assetReleaseId,'restored generation mismatch');assert.equal(result.complete,d.complete,'restored completeness mismatch');
  return result;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const [mode,...args]=process.argv.slice(2),options={};
  assert(['pack','plan','restore'].includes(mode),'usage: image-distribution.mjs pack|plan --release DIR --output NEW_DIR | restore --input DIR --output NEW_DIR --region REGION --sha256 PIN');
  for(let i=0;i<args.length;i+=2) {assert(/^--(release|input|output|region|sha256)$/.test(args[i])&&args[i+1]&&!Object.hasOwn(options,args[i]),'invalid/duplicate option');options[args[i]]=args[i+1];}
  assert(options['--output'],'new output directory required');
  if(mode==='pack'||mode==='plan'){assert(options['--release'],'release required');console.log(JSON.stringify(packImageDistribution(options['--release'],options['--output'],{indexOnly:mode==='plan'})));}
  else {assert(options['--input'],'input required');console.log(JSON.stringify(restoreImageDistribution(options['--input'],options['--output'],{region:options['--region'],indexSha256:options['--sha256']})));}
}
