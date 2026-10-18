import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fetchImageDistribution} from './fetch-images.mjs';
import {restoreImageDistribution,parseImageDistributionIndex} from './image-distribution.mjs';
import {fixture,hash} from './test-fixtures/image-pack.mjs';
import {FREE_RESERVE,requireDownloadSpace,requireSpace} from './storage-space.mjs';

function input(f) {
  return {...f,directory:path.join(f.temporary,'download'),
    distributionId:JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json'))).distributionId};
}

test('low space rejects before index download and leaves no owned lock or partial file',async t=>{
  const f=fixture();try {
    const options=input(f),remote=server(f);
    t.mock.method(fs,'statfsSync',()=>({bsize:1n,bavail:FREE_RESERVE}));
    await assert.rejects(fetchImageDistribution(options,remote.fetch),/Insufficient image storage/);
    assert.deepEqual(remote.calls,[]);assert.deepEqual(fs.readdirSync(options.directory),[]);
  }finally{f.close();}
});

test('same-filesystem download plus restoration is budgeted together before requesting chunks',async t=>{
  const f=fixture();try {
    const options=input(f),remote=server(f),restoreDirectory=path.join(f.temporary,'restore');
    fs.mkdirSync(options.directory);
    fs.copyFileSync(path.join(f.input,'distribution.json'),path.join(options.directory,'distribution.json'));
    const index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json')));
    const total=index.chunks.reduce((sum,chunk)=>sum+chunk.bytes,0);
    t.mock.method(fs,'statfsSync',()=>({bsize:1n,bavail:FREE_RESERVE+BigInt(total)}));
    await assert.rejects(fetchImageDistribution({...options,restoreDirectory},remote.fetch),/Insufficient image storage/);
    assert.deepEqual(remote.calls,[]);assert(!fs.existsSync(restoreDirectory));
    assert.deepEqual(fs.readdirSync(options.directory),['distribution.json']);
    const accepted=await fetchImageDistribution(options,remote.fetch);
    assert.equal(accepted.download,'VERIFIED_DISTRIBUTION');
  }finally{f.close();}
});

test('corrupt retained later chunk is detected before downloading any earlier missing chunk',async()=>{
  const f=fixture();try {
    const options=input(f),remote=server(f),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json')));
    fs.mkdirSync(options.directory);
    fs.copyFileSync(path.join(f.input,'distribution.json'),path.join(options.directory,'distribution.json'));
    const last=index.chunks.at(-1),file=path.join(options.directory,last.path),bytes=fs.readFileSync(path.join(f.input,last.path));
    bytes[0]^=1;fs.writeFileSync(file,bytes);
    await assert.rejects(fetchImageDistribution(options,remote.fetch),/no overwrite/);
    assert.deepEqual(remote.calls,[]);assert.deepEqual(fs.readFileSync(file),bytes);
    assert.deepEqual(fs.readdirSync(options.directory).sort(),['distribution.json',last.path].sort());
  }finally{f.close();}
});

test('verified existing chunks do not count as future writes and final verification still holds the lock',async t=>{
  const f=fixture();try {
    const options=input(f),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json'))),last=index.chunks.at(-1);
    fs.mkdirSync(options.directory);
    for(const name of ['distribution.json',...index.chunks.slice(0,-1).map(c=>c.path)])
      fs.copyFileSync(path.join(f.input,name),path.join(options.directory,name));
    t.mock.method(fs,'statfsSync',()=>({bsize:1n,bavail:FREE_RESERVE+BigInt(last.bytes)}));
    const remote=server(f),read=fs.readdirSync.bind(fs);let verifiedUnderLock=false;
    t.mock.method(fs,'readdirSync',(target,...args)=>{
      if(path.resolve(target)===options.directory&&fs.existsSync(path.join(options.directory,last.path))
        &&fs.existsSync(path.join(options.directory,'.image-download.lock')))verifiedUnderLock=true;
      return read(target,...args);
    });
    const accepted=await fetchImageDistribution(options,remote.fetch);
    assert.equal(accepted.downloaded,1);assert.deepEqual(remote.calls,[last.path]);assert(verifiedUnderLock);
  }finally{f.close();}
});

test('space is checked on each destination filesystem and unknown capacity is not silently accepted',t=>{
  const f=fixture();try {
    const output=path.join(f.temporary,'other-volume');fs.mkdirSync(output);
    const stat=fs.statSync.bind(fs),lookups=[];
    t.mock.method(fs,'statSync',(target,...args)=>{
      const result=stat(target,...args);if(path.resolve(target)===output)result.dev+=1n;return result;
    });
    let available=FREE_RESERVE+100n;
    t.mock.method(fs,'statfsSync',target=>{lookups.push(path.resolve(target));return {bsize:1n,bavail:available};});
    requireDownloadSpace(f.input,60,output,80);
    assert.deepEqual(lookups,[f.input,output]);
    assert.throws(()=>requireDownloadSpace(f.input,60,output,101),/Insufficient image storage/);
    available=-1n;
    assert.throws(()=>requireSpace(f.input,0),/space is unknown/);
  }finally{f.close();}
});
function server(f,{interrupt,change}={}) {
  const calls=[];
  return {calls,fetch:async(url,options)=>{
    const parsed=new URL(url),name=path.posix.basename(parsed.pathname);calls.push(name);
    assert.equal(options.redirect,'manual');assert(options.signal instanceof AbortSignal);
    assert(!Object.keys(options.headers).some(k=>k.toLowerCase()==='authorization'));
    if(interrupt===name)throw new Error('simulated timeout');
    let bytes=fs.readFileSync(path.join(f.input,name));if(change===name){bytes=Buffer.from(bytes);bytes[0]^=1;}
    return new Response(bytes,{headers:{'content-length':String(bytes.length)}});
  }};
}

test('public image download restores identical validated PNGs and rerun uses only pinned local chunks',async()=>{
  const f=fixture();try {
    const options=input(f),remote=server(f),result=await fetchImageDistribution(options,remote.fetch);
    assert.equal(result.download,'VERIFIED_DISTRIBUTION');assert.equal(result.activation,'NOT_ACTIVATED');
    assert.equal(result.downloaded,fs.readdirSync(f.input).length);assert.equal(result.reused,0);
    const restored=path.join(f.temporary,'restored'),accepted=restoreImageDistribution(options.directory,restored,f);
    assert.equal(accepted.manifestSha256,result.manifestSha256);
    const png=fs.readdirSync(path.join(f.release,'images'))[0];
    assert.deepEqual(fs.readFileSync(path.join(f.release,'images',png)),fs.readFileSync(path.join(restored,'images',png)));
    const rerun=await fetchImageDistribution(options,()=>{throw new Error('must not access network');});
    assert.equal(rerun.downloaded,0);assert.equal(rerun.reused,result.downloaded);
  }finally{f.close();}
});

test('interrupted chunk resumes without re-fetching complete chunks or leaving blocked temporary files',async()=>{
  const f=fixture();try {
    const options=input(f),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json')));
    await assert.rejects(fetchImageDistribution(options,server(f,{interrupt:index.chunks[1].path}).fetch),/timed out/);
    assert.deepEqual(fs.readdirSync(options.directory).sort(),['distribution.json',index.chunks[0].path].sort());
    const remote=server(f),result=await fetchImageDistribution(options,remote.fetch);
    assert.equal(result.reused,2);assert(!remote.calls.includes(index.chunks[0].path));
    assert(!fs.readdirSync(options.directory).some(name=>name.endsWith('.part')||name.endsWith('.lock')));
  }finally{f.close();}
});

test('index pin, incomplete flag, region and generation all gate requests for chunk bodies',async()=>{
  const f=fixture({complete:false});try {
    const base=input(f);
    for(const [suffix,override,pattern] of [
      ['hash',{indexSha256:'0'.repeat(64)},/integrity mismatch/],
      ['region',{region:'international'},/distribution identity/],
      ['generation',{distributionId:'gad1-'+'0'.repeat(24)},/generation differs/],
      ['incomplete',{},/allow-incomplete/],
    ]) {
      const remote=server(f);
      await assert.rejects(fetchImageDistribution({...base,...override,directory:base.directory+'-'+suffix},remote.fetch),pattern);
      assert.deepEqual(remote.calls,['distribution.json']);
    }
    const accepted=await fetchImageDistribution({...base,allowIncomplete:true},server(f).fetch);
    assert.equal(accepted.complete,false);
  }finally{f.close();}
});

test('corruption, byte overrun and existing local conflicts never replace accepted bytes',async()=>{
  const f=fixture();try {
    const options=input(f),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json'))),first=index.chunks[0].path;
    await assert.rejects(fetchImageDistribution(options,server(f,{change:first}).fetch),/integrity mismatch/);
    assert.deepEqual(fs.readdirSync(options.directory),['distribution.json']);
    const local=path.join(options.directory,first);fs.writeFileSync(local,'keep-local-evidence');
    const remote=server(f);await assert.rejects(fetchImageDistribution(options,remote.fetch),/no overwrite/);
    assert.equal(fs.readFileSync(local,'utf8'),'keep-local-evidence');assert.equal(remote.calls.length,0);
    const tooLarge=async()=>new Response(new Uint8Array(8*1024*1024+1));
    await assert.rejects(fetchImageDistribution({...options,directory:options.directory+'-oversize'},tooLarge),/exceeds pinned bounds/);
    assert.deepEqual(fs.readdirSync(options.directory+'-oversize'),[]);
  }finally{f.close();}
});

test('manual CDN redirects retain a total deadline and never forward credentials or expose URLs',async()=>{
  const f=fixture();try {
    const options=input(f),normal=server(f);let lastSignal;
    const fetch=async(url,request)=>{
      if(new URL(url).hostname==='github.com') {
        lastSignal=request.signal;
        return new Response(null,{status:302,headers:{location:'https://release-assets.githubusercontent.com/'+path.posix.basename(new URL(url).pathname)+'?private-signature=do-not-log'}});
      }
      assert.equal(request.signal,lastSignal);assert(!request.headers.Authorization);
      return normal.fetch(url,request);
    };
    await fetchImageDistribution(options,fetch);
    let requests=0;
    await assert.rejects(fetchImageDistribution({...options,directory:options.directory+'-redirect'},async()=>{
      requests++;return new Response(null,{status:302,headers:{location:'https://untrusted.invalid/private'}});
    }),e=>e.message==='unexpected image download origin');
    assert.equal(requests,1);
  }finally{f.close();}
});

test('exclusive lock and dedicated inventory reject concurrent or unrelated output directories',async()=>{
  const f=fixture();try {
    const options=input(f);fs.mkdirSync(options.directory);fs.writeFileSync(path.join(options.directory,'.image-download.lock'),'owner');
    await assert.rejects(fetchImageDistribution(options,()=>{throw new Error('no network');}),/locked/);
    assert.equal(fs.readFileSync(path.join(options.directory,'.image-download.lock'),'utf8'),'owner');
    const other={...options,directory:options.directory+'-other'};fs.mkdirSync(other.directory);fs.writeFileSync(path.join(other.directory,'keep.txt'),'keep');
    await assert.rejects(fetchImageDistribution(other,()=>{throw new Error('no network');}),/not empty/);
    assert.deepEqual(fs.readdirSync(other.directory),['keep.txt']);
    const bytes=fs.readFileSync(path.join(f.input,'distribution.json')),index=JSON.parse(bytes);
    index.files[0].path='../escape.png';delete index.distributionId;
    index.distributionId='gad1-'+hash(Buffer.from(JSON.stringify(index))).slice(0,24);
    const malformed=Buffer.from(JSON.stringify(index));
    assert.throws(()=>parseImageDistributionIndex(malformed,{region:f.region,indexSha256:hash(malformed)}),/distribution file/);
  }finally{f.close();}
});
