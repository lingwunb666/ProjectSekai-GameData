import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {packImageDistribution,verifyImageDistribution,verifyImageDistributionPlan,
  withImageDistributionChunk,restoreImageDistribution} from './image-distribution.mjs';
import {FREE_RESERVE} from './storage-space.mjs';
import {fixture,hash} from './test-fixtures/image-pack.mjs';

export function planned(f) {
  const input=path.join(f.temporary,'plan');
  const result=packImageDistribution(f.release,input,{chunkBytes:3000,indexOnly:true});
  assert.equal(result.indexSha256,f.indexSha256);
  return {...f,input};
}

test('restore refuses insufficient capacity before creating any output',t=>{
  const f=fixture();try {
    const output=path.join(f.temporary,'restore'),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json')));
    const bytes=index.chunks.reduce((sum,chunk)=>sum+chunk.bytes,0);
    t.mock.method(fs,'statfsSync',()=>({bsize:1n,bavail:FREE_RESERVE+BigInt(bytes)-1n}));
    assert.throws(()=>restoreImageDistribution(f.input,output,f),/Insufficient image storage/);
    assert(!fs.existsSync(output));assert.equal(verifyImageDistribution(f.input,f).indexSha256,f.indexSha256);
  }finally{f.close();}
});

test('restore checks a corrupt last chunk before writing any earlier images',()=>{
  const f=fixture();try {
    const output=path.join(f.temporary,'restore'),index=JSON.parse(fs.readFileSync(path.join(f.input,'distribution.json')));
    const file=path.join(f.input,index.chunks.at(-1).path),bytes=fs.readFileSync(file);bytes[0]^=1;fs.writeFileSync(file,bytes);
    assert.throws(()=>restoreImageDistribution(f.input,output,f),/chunk integrity mismatch/);
    assert(!fs.existsSync(output));assert.deepEqual(fs.readFileSync(file),bytes);
  }finally{f.close();}
});

test('index-only plan has byte-identical pins and chunks without creating a second image pack',async()=>{
  const f=fixture();try {
    const p=planned(f),verified=verifyImageDistributionPlan(p.release,p.input,p);
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    assert.deepEqual(fs.readFileSync(path.join(f.input,'distribution.json')),fs.readFileSync(path.join(p.input,'distribution.json')));
    assert.throws(()=>verifyImageDistribution(p.input,p),/extra distribution files/);
    assert.throws(()=>verifyImageDistributionPlan(f.release,f.input,f),/index-only directory/);
    for(const chunk of verified.index.chunks) {
      const reserved=[];
      await withImageDistributionChunk(p.release,p.input,p,chunk.path,async file=>{
        assert.equal(path.dirname(file),path.join(p.input,'.upload'));
        assert.deepEqual(fs.readdirSync(path.dirname(file)),[chunk.path]);
        assert.deepEqual(fs.readFileSync(file),fs.readFileSync(path.join(f.input,chunk.path)));
        assert.equal(hash(fs.readFileSync(file)),chunk.sha256);
      },{checkStorage:bytes=>reserved.push(bytes)});
      assert.equal(reserved[0],chunk.bytes);assert(reserved.slice(1).every(n=>n===0));
      assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    }
  }finally{f.close();}
});

test('upload failure and preflight budget failure release only the owned temporary chunk',async()=>{
  const f=fixture();try {
    const p=planned(f),chunk=verifyImageDistributionPlan(p.release,p.input,p).index.chunks[0];
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,()=>{throw new Error('upload stopped');}),/upload stopped/);
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    let called=false;
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,()=>{called=true;},
      {checkStorage:n=>{if(n>0){assert.deepEqual(fs.readdirSync(path.join(p.input,'.upload')),[]);throw new Error('budget');}}}),/budget/);
    assert.equal(called,false);assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    assert.equal(verifyImageDistributionPlan(p.release,p.input,p).index.chunks[0].sha256,chunk.sha256);
  }finally{f.close();}
});

test('changed source or projected chunk digest cannot reach the upload callback',async()=>{
  const f=fixture();try {
    const p=planned(f),d=verifyImageDistributionPlan(p.release,p.input,p).index;
    const first=d.files.find(file=>file.chunk===0),source=path.join(p.release,first.path),bytes=fs.readFileSync(source);
    bytes[0]^=1;fs.writeFileSync(source,bytes);
    assert.throws(()=>verifyImageDistributionPlan(p.release,p.input,p),/source file integrity/);
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,d.chunks[0].path,
      ()=>assert.fail('invalid source uploaded')),/source file integrity/);
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    bytes[0]^=1;fs.writeFileSync(source,bytes);
    d.chunks[0].sha256='0'.repeat(64);delete d.distributionId;
    d.distributionId='gad1-'+hash(Buffer.from(JSON.stringify(d))).slice(0,24);
    const changed=Buffer.from(JSON.stringify(d)+'\n');fs.writeFileSync(path.join(p.input,'distribution.json'),changed);
    const pin={...p,indexSha256:hash(changed)};
    assert.throws(()=>verifyImageDistributionPlan(p.release,p.input,pin),/projected chunk integrity/);
    await assert.rejects(withImageDistributionChunk(p.release,p.input,pin,d.chunks[0].path,
      ()=>assert.fail('invalid chunk uploaded')),/projected chunk integrity/);
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
  }finally{f.close();}
});

test('concurrent or stale upload directory is not stolen or cleaned',async()=>{
  const f=fixture();try {
    const p=planned(f),chunk=verifyImageDistributionPlan(p.release,p.input,p).index.chunks[0];
    await withImageDistributionChunk(p.release,p.input,p,chunk.path,async file=>{
      await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,()=>{}),/index-only directory/);
      assert(fs.existsSync(file));
    });
    fs.mkdirSync(path.join(p.input,'.upload'));fs.writeFileSync(path.join(p.input,'.upload','foreign'),'keep');
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,()=>{}),/index-only directory/);
    assert.equal(fs.readFileSync(path.join(p.input,'.upload','foreign'),'utf8'),'keep');
  }finally{f.close();}
});

test('changed leased file is retained for inspection rather than deleting user data',async()=>{
  const f=fixture();try {
    const p=planned(f),chunk=verifyImageDistributionPlan(p.release,p.input,p).index.chunks[0];let file;
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,current=>{
      file=current;fs.appendFileSync(current,'changed');
    }),/upload file changed/);
    assert.equal(fs.statSync(file).size,chunk.bytes+7);
    assert.throws(()=>verifyImageDistributionPlan(p.release,p.input,p),/index-only directory/);
  }finally{f.close();}
});

test('foreign file appearing in lease directory is never recursively removed',async()=>{
  const f=fixture();try {
    const p=planned(f),chunk=verifyImageDistributionPlan(p.release,p.input,p).index.chunks[0];
    const foreign=path.join(p.input,'.upload','foreign');
    await assert.rejects(withImageDistributionChunk(p.release,p.input,p,chunk.path,()=>{
      fs.writeFileSync(foreign,'keep');
    }),/ENOTEMPTY|EEXIST/);
    assert.equal(fs.readFileSync(foreign,'utf8'),'keep');
    assert.deepEqual(fs.readdirSync(path.dirname(foreign)),['foreign']);
  }finally{f.close();}
});
