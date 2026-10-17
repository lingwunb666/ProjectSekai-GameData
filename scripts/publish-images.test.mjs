import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {prepareImagePublication,publishPreparedImages,githubImageClient} from './publish-images.mjs';
import {verifyImageDistribution,packImageDistribution} from './image-distribution.mjs';
import {fixture,hash} from './test-fixtures/image-pack.mjs';

function remote(plan) {
  const state={release:null,assets:[],calls:[],tag:null,failAt:null};
  const client={
    async commit(sha){state.calls.push('commit');return {sha};},
    async tag(){state.calls.push('tag');return state.tag;},
    async find(){state.calls.push('find');return state.release;},
    async create(p){state.calls.push('create');return state.release={id:1,tag_name:p.tag,target_commitish:p.commit,
      body:p.body,prerelease:!p.pin.complete,draft:true};},
    async assets(){state.calls.push('assets');return structuredClone(state.assets);},
    async upload(release,asset,file){
      state.calls.push('upload:'+asset.name);if(state.failAt===asset.name)throw new Error('simulated upload interruption');
      const bytes=fs.readFileSync(file),result={name:asset.name,size:bytes.length,state:'uploaded',digest:'sha256:'+hash(bytes)};
      state.assets.push(result);return result;
    },
    async publish(){state.calls.push('publish');state.release.draft=false;
      state.tag={ref:'refs/tags/'+plan.tag,object:{type:'commit',sha:plan.commit}};return state.release;},
  };
  return {state,client};
}

test('streamed distribution validates individual files as well as chunks without restoring a second pack',()=>{
  const f=fixture();try {
    const plan=prepareImagePublication(f);assert.equal(plan.pin.complete,true);
    assert(plan.assets.length>=3);assert.equal(verifyImageDistribution(f.input,f).index.distributionId,plan.pin.distributionId);
    const file=path.join(f.input,plan.assets[0].name),bytes=fs.readFileSync(file);bytes[0]^=1;fs.writeFileSync(file,bytes);
    assert.throws(()=>prepareImagePublication(f),/file integrity mismatch/);
  }finally{f.close();}
});

test('default CLI validates locally without token, uploads or Git mutations',()=>{
  const f=fixture();try {
    const child=spawnSync(process.execPath,['scripts/publish-images.mjs','--release',f.release,'--input',f.input,
      '--region',f.region,'--sha256',f.indexSha256,'--commit',f.commit],{encoding:'utf8',env:{...process.env,GH_TOKEN:'',GITHUB_TOKEN:''}});
    assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).publication,'LOCAL_VALIDATION_ONLY');
    assert(!child.stdout.includes(f.temporary),'public report does not expose local evidence paths');
  }finally{f.close();}
});

test('draft publication checks all digests, resumes uploaded assets and is idempotent after publication',async()=>{
  const f=fixture();try {
    const plan=prepareImagePublication(f),{state,client}=remote(plan);state.failAt=plan.assets[1].name;
    await assert.rejects(publishPreparedImages(plan,client),/interruption/);
    assert.equal(state.release.draft,true);assert.equal(state.assets.length,1);assert(!state.calls.includes('publish'));
    state.failAt=null;
    assert.equal((await publishPreparedImages(plan,client)).publication,'PUBLISHED');
    assert.equal(state.calls.filter(c=>c==='upload:'+plan.assets[0].name).length,1,'already verified attachment is not resent');
    assert.equal(state.assets.length,plan.assets.length);
    const uploads=state.calls.filter(c=>c.startsWith('upload:')).length;
    assert.equal((await publishPreparedImages(plan,client)).publication,'ALREADY_PUBLISHED');
    assert.equal(state.calls.filter(c=>c.startsWith('upload:')).length,uploads);
  }finally{f.close();}
});

test('remote collision or starter/digestless asset is never deleted, overwritten or published',async()=>{
  const f=fixture();try {
    const plan=prepareImagePublication(f);
    for(const change of [asset=>asset.digest='sha256:'+'0'.repeat(64),asset=>asset.state='starter',asset=>delete asset.digest]) {
      const {state,client}=remote(plan);await client.create(plan);
      state.assets.push({name:plan.assets[0].name,state:'uploaded',size:plan.assets[0].bytes,digest:'sha256:'+plan.assets[0].sha256});
      change(state.assets[0]);await assert.rejects(publishPreparedImages(plan,client),/no overwrite\/delete/);
      assert(!state.calls.some(c=>c.startsWith('upload:')));assert(!state.calls.includes('publish'));
    }
  }finally{f.close();}
});

test('incomplete publication needs explicit approval and remains a prerelease',async()=>{
  const f=fixture({complete:false});try {
    const plan=prepareImagePublication(f),{state,client}=remote(plan);
    await assert.rejects(publishPreparedImages(plan,client),/allow-incomplete/);assert.equal(state.calls.length,0);
    await publishPreparedImages(plan,client,{allowIncomplete:true});assert.equal(state.release.prerelease,true);
    assert.equal(plan.pin.complete,false);
  }finally{f.close();}
});

test('conflicting commit tag and user-edited release body stop before any upload',async()=>{
  const f=fixture();try {
    const plan=prepareImagePublication(f),first=remote(plan);
    first.state.tag={ref:'refs/tags/'+plan.tag,object:{type:'commit',sha:'c'.repeat(40)}};
    await assert.rejects(publishPreparedImages(plan,first.client),/points elsewhere/);assert(!first.state.calls.includes('create'));
    const second=remote(plan);await second.client.create(plan);second.state.release.body+=' user notes';
    await assert.rejects(publishPreparedImages(plan,second.client),/metadata differs/);
    assert(!second.state.calls.some(c=>c.startsWith('upload:')));
  }finally{f.close();}
});

test('HTTP client bounds origins, hides error bodies, disables redirects and never marks images latest',async()=>{
  const f=fixture();try {
    const plan=prepareImagePublication(f),calls=[];
    const client=githubImageClient('test-only-placeholder',async(url,request)=>{
      calls.push({url,request});return Response.json({id:1});
    });
    await client.create(plan);await client.publish(1);
    for(const call of calls) {
      assert.equal(call.request.redirect,'error');assert(call.request.signal instanceof AbortSignal);
      const body=JSON.parse(call.request.body);assert.equal(body.make_latest,'false');
    }
    assert.equal(JSON.parse(calls[0].request.body).draft,true);
    await assert.rejects(client.upload({id:1,upload_url:'https://not-github.invalid/'},plan.assets[0],'unused'),/upload URL/);
    const failed=githubImageClient('test-only-placeholder',async()=>new Response('private response must not be logged',{status:503}));
    await assert.rejects(failed.commit(plan.commit),error=>error.message.includes('HTTP 503')&&!error.message.includes('private response'));
  }finally{f.close();}
});

function onDemandFixture(f) {
  const input=path.join(f.temporary,'plan');
  const index=packImageDistribution(f.release,input,{indexOnly:true,chunkBytes:3000});
  return {...f,input,indexSha256:index.indexSha256,onDemand:true};
}

test('commit validation uses the bounded Git object endpoint, not a potentially huge dataset diff',async()=>{
  const sha='a'.repeat(40),calls=[];
  const client=githubImageClient('test-only-placeholder',async(url,request)=>{
    calls.push(url);assert.equal(request.redirect,'error');
    assert.equal(url,'https://api.github.com/repos/lingwunb666/ProjectSekai-GameData/git/commits/'+sha);
    return Response.json({sha,tree:{sha:'b'.repeat(40)}});
  });
  assert.equal((await client.commit(sha)).sha,sha);
  await assert.rejects(client.commit('main'),/explicit commit SHA/);
  assert.equal(calls.length,1);
});

test('on-demand publisher stages only a missing chunk and removes it on failure before resumable retry',async()=>{
  const f=fixture();try {
    const p=onDemandFixture(f),plan=prepareImagePublication(p),{state,client}=remote(plan),reservations=[];
    const upload=client.upload;
    client.upload=async(release,asset,file)=>{
      if(asset.name==='distribution.json')assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
      else {
        assert.deepEqual(fs.readdirSync(p.input).sort(),['.upload','distribution.json']);
        assert.deepEqual(fs.readdirSync(path.join(p.input,'.upload')),[asset.name]);
      }
      return upload(release,asset,file);
    };
    const policy={checkStorage:n=>{if(n>0)reservations.push(n);}};
    state.failAt=plan.assets[1].name;
    await assert.rejects(publishPreparedImages(plan,client,policy),/interruption/);
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);assert.equal(state.assets.length,1);
    state.failAt=null;
    assert.equal((await publishPreparedImages(prepareImagePublication(p),client,policy)).publication,'PUBLISHED');
    assert.equal(state.calls.filter(c=>c==='upload:'+plan.assets[0].name).length,1);
    assert.equal(reservations.length,plan.assets.length,'one failed attempt plus each non-index chunk');
    assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    const count=reservations.length;
    assert.equal((await publishPreparedImages(plan,client,policy)).publication,'ALREADY_PUBLISHED');
    assert.equal(reservations.length,count,'verified remote assets do not even create local chunks');
  }finally{f.close();}
});

test('on-demand CLI remains local-only by default and requires an explicit index-only mode',()=>{
  const f=fixture();try {
    const p=onDemandFixture(f),args=['scripts/publish-images.mjs','--release',p.release,'--input',p.input,
      '--region',p.region,'--sha256',p.indexSha256,'--commit',p.commit];
    const env={...process.env,GH_TOKEN:'',GITHUB_TOKEN:''};
    const child=spawnSync(process.execPath,[...args,'--on-demand'],{encoding:'utf8',env});
    assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).publication,'LOCAL_VALIDATION_ONLY');
    assert(!child.stdout.includes(f.temporary));assert.deepEqual(fs.readdirSync(p.input),['distribution.json']);
    assert.notEqual(spawnSync(process.execPath,args,{encoding:'utf8',env}).status,0);
  }finally{f.close();}
});
