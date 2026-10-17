// Explicit, resumable image-attachment publication. Default invocation is LOCAL ONLY.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {verifyImagePack} from './verify-images.mjs';
import {verifyImageDistribution,verifyImageDistributionPlan,withImageDistributionChunk} from './image-distribution.mjs';

const REPOSITORY='lingwunb666/ProjectSekai-GameData';
const API=`https://api.github.com/repos/${REPOSITORY}`;
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function noLinks(file) {
  for(let p=path.resolve(file);;p=path.dirname(p)) {
    assert(!fs.lstatSync(p).isSymbolicLink(),'linked publication input is forbidden');
    if(path.dirname(p)===p)break;
  }
}

export function prepareImagePublication({release,input,region,indexSha256,commit,onDemand=false}) {
  assert(typeof commit==='string'&&/^[a-f0-9]{40}$/.test(commit),'explicit full target commit required');
  const accepted=verifyImagePack(release,{region});
  const {index,indexBytes}=onDemand?verifyImageDistributionPlan(release,input,{region,indexSha256})
    :verifyImageDistribution(input,{region,indexSha256});
  assert.equal(index.region,accepted.region,'publication region mismatch');
  assert.equal(index.manifestSha256,accepted.manifestSha256,'publication manifest mismatch');
  assert.equal(index.assetReleaseId,accepted.assetReleaseId,'publication asset generation mismatch');
  assert.equal(index.complete,accepted.complete,'publication completeness mismatch');
  const manifestPath=path.join(release,'manifest.json');noLinks(manifestPath);
  assert(fs.statSync(manifestPath).size<=8*1024*1024,'image manifest grew beyond bound');
  const fd=fs.openSync(manifestPath,'r');let bytes;
  try {const buffer=Buffer.alloc(8*1024*1024+1);let size=0,n;
    while(size<buffer.length&&(n=fs.readSync(fd,buffer,size,buffer.length-size,null))>0)size+=n;
    assert(size<=8*1024*1024,'image manifest grew beyond bound');bytes=buffer.subarray(0,size);
  }finally{fs.closeSync(fd);}
  assert.equal(hash(bytes),accepted.manifestSha256,'image manifest changed during preparation');
  const manifest=JSON.parse(bytes);
  assert.equal(index.clientBuild,manifest.clientBuild,'publication client build mismatch');
  assert.equal(index.clientArtifactSha256,manifest.clientArtifactSha256,'publication client identity mismatch');
  const inventory=[{path:'manifest.json',bytes:bytes.length,sha256:accepted.manifestSha256},
    ...Object.values(manifest.metadata),...manifest.files].map(({path,bytes,sha256})=>({path,bytes,sha256}));
  const sorted=items=>items.toSorted((a,b)=>a.path.localeCompare(b.path,'en'));
  assert.deepEqual(sorted(index.files.map(({path,bytes,sha256})=>({path,bytes,sha256}))),sorted(inventory),
    'distribution must contain exactly the independently verified image pack');
  assert(index.chunks.length<64,'image publication attachment limit is 64; use standard 256 MiB packing');
  const assets=[...index.chunks.map(c=>({name:c.path,bytes:c.bytes,sha256:c.sha256})),
    {name:'distribution.json',bytes:indexBytes,sha256:indexSha256}];
  const tag=`images-${region}-${index.distributionId}`;
  const pin={schemaVersion:1,region,distributionId:index.distributionId,assetReleaseId:index.assetReleaseId,
    indexSha256,manifestSha256:index.manifestSha256,clientBuild:index.clientBuild,
    clientArtifactSha256:index.clientArtifactSha256,complete:index.complete,targetCommit:commit};
  const body='ProjectSekai regional image assets. Not automatic production activation.\n\n'
    +(index.complete?'':'INCOMPLETE PREVIEW: diagnostics remain; not full image coverage.\n\n')
    +'```json\n'+JSON.stringify(pin,null,2)+'\n```\n';
  return {repository:REPOSITORY,tag,commit,body,pin,assets,input:path.resolve(input),release:path.resolve(release),onDemand};
}

/** Only fixed GitHub API/upload origins, no redirects or response-body logging. */
export function githubImageClient(token,fetcher=fetch) {
  assert(typeof token==='string'&&token.trim()&&!/[\r\n]/.test(token),'GH_TOKEN or GITHUB_TOKEN is required');
  async function request(url,{method='GET',json,body,type,allow404=false,timeoutMs=120_000}={}) {
    const parsed=new URL(url),allowed=(parsed.origin==='https://api.github.com'||parsed.origin==='https://uploads.github.com')
      &&parsed.pathname.startsWith(`/repos/${REPOSITORY}/`);
    assert(allowed&&!parsed.username&&!parsed.password&&!parsed.hash,'unexpected GitHub request URL');
    const headers={Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,
      'X-GitHub-Api-Version':'2026-03-10','User-Agent':'ProjectSekai-GameData-image-publisher'};
    if(json!==undefined){headers['Content-Type']='application/json';body=JSON.stringify(json);}
    if(type)headers['Content-Type']=type;
    let response;
    try {response=await fetcher(url,{method,headers,body,redirect:'error',signal:AbortSignal.timeout(timeoutMs)});}
    catch {throw new Error('GitHub request failed or timed out; rerun to inspect and resume the draft');}
    if(allow404&&response.status===404){await response.body?.cancel();return null;}
    if(!response.ok){await response.body?.cancel();throw new Error(`GitHub request failed with HTTP ${response.status}; draft was not deleted`);}
    const parts=[];let length=0;
    try {
      for await(const part of response.body){length+=part.length;assert(length<=2*1024*1024,'GitHub metadata response exceeds bound');parts.push(part);}
      return JSON.parse(Buffer.concat(parts).toString('utf8'));
    }catch{throw new Error('GitHub metadata response is invalid or incomplete');}
  }
  return {
    // Inspect the small Git object, not the REST commit diff (dataset patches can be enormous).
    async commit(sha){assert(typeof sha==='string'&&/^[a-f0-9]{40}$/.test(sha),'explicit commit SHA required');
      return request(`${API}/git/commits/${sha}`);},
    async tag(tag){return request(`${API}/git/ref/tags/${tag}`,{allow404:true});},
    async find(tag){
      // Listing is required for resumable drafts; the public tag endpoint is not a draft inventory.
      for(let page=1;page<=20;page++) {
        const releases=await request(`${API}/releases?per_page=100&page=${page}`);
        assert(Array.isArray(releases)&&releases.length<=100,'invalid release inventory');
        const matches=releases.filter(r=>r.tag_name===tag);assert(matches.length<=1,'ambiguous release tag');
        if(matches.length)return matches[0];if(releases.length<100)return null;
      }
      throw new Error('Release discovery bound exceeded; refusing to create an unconfirmed duplicate');
    },
    async create(plan){return request(`${API}/releases`,{method:'POST',json:{tag_name:plan.tag,target_commitish:plan.commit,
      name:plan.tag,body:plan.body,draft:true,prerelease:!plan.pin.complete,make_latest:'false',generate_release_notes:false}});},
    async assets(id){
      assert(Number.isSafeInteger(id)&&id>0,'invalid release id');
      const assets=await request(`${API}/releases/${id}/assets?per_page=100`);
      assert(Array.isArray(assets)&&assets.length<100,'release attachment inventory exceeds bound');return assets;
    },
    async upload(release,asset,file){
      const upload=release.upload_url;
      assert(typeof upload==='string'&&upload===`https://uploads.github.com/repos/${REPOSITORY}/releases/${release.id}/assets{?name,label}`,
        'unexpected GitHub upload URL');
      const url=upload.replace('{?name,label}','?name='+encodeURIComponent(asset.name));
      // File-backed Blob streams the chunk and detects changes, without loading 256 MiB into the JS heap.
      noLinks(file);
      const body=await fs.openAsBlob(file);assert.equal(body.size,asset.bytes,'upload file size changed');
      const digest=createHash('sha256');for await(const bytes of body.stream())digest.update(bytes);
      assert.equal(digest.digest('hex'),asset.sha256,'upload file changed before streaming');
      return request(url,{method:'POST',body,type:asset.name.endsWith('.json')?'application/json':'application/octet-stream',
        timeoutMs:600_000});
    },
    async publish(id){return request(`${API}/releases/${id}`,{method:'PATCH',json:{draft:false,make_latest:'false'}});},
  };
}

function validateRelease(release,plan) {
  assert(Number.isSafeInteger(release?.id)&&release.id>0&&typeof release.draft==='boolean','invalid GitHub release');
  assert(release.tag_name===plan.tag&&release.target_commitish===plan.commit&&release.body===plan.body
    &&release.prerelease===!plan.pin.complete,'existing release metadata differs; refusing to modify it');
}
function validateAsset(asset,expected) {
  assert(asset?.name===expected.name&&asset.state==='uploaded'&&asset.size===expected.bytes
    &&asset.digest==='sha256:'+expected.sha256,'remote attachment differs or has no verified digest; no overwrite/delete');
}
function inventory(assets,plan,{complete=false}={}) {
  const expected=new Map(plan.assets.map(a=>[a.name,a])),seen=new Map();
  for(const asset of assets) {
    assert(expected.has(asset.name)&&!seen.has(asset.name),'unexpected/duplicate remote attachment; refusing to modify release');
    validateAsset(asset,expected.get(asset.name));seen.set(asset.name,asset);
  }
  if(complete)assert.equal(seen.size,expected.size,'remote attachment inventory is incomplete');return seen;
}
async function requireTag(client,plan,{required=false}={}) {
  const tag=await client.tag(plan.tag);
  assert(!required||tag,'published tag is missing');
  if(tag)assert(tag.ref===`refs/tags/${plan.tag}`&&tag.object?.type==='commit'&&tag.object.sha===plan.commit,
    'existing tag points elsewhere; refusing to change it');
}

export async function publishPreparedImages(plan,client,{allowIncomplete=false,checkStorage=()=>{}}={}) {
  assert(plan.pin.complete||allowIncomplete,'incomplete image pack requires explicit --allow-incomplete');
  assert.equal((await client.commit(plan.commit)).sha,plan.commit,'target commit is not in the selected repository');
  await requireTag(client,plan);
  let release=await client.find(plan.tag);
  if(release)validateRelease(release,plan);
  else {release=await client.create(plan);validateRelease(release,plan);assert(release.draft,'new release must start as draft');}
  const uploaded=inventory(await client.assets(release.id),plan,{complete:!release.draft});
  if(!release.draft){await requireTag(client,plan,{required:true});return {publication:'ALREADY_PUBLISHED',releaseId:release.id,...plan.pin};}
  for(const asset of plan.assets) {
    if(uploaded.has(asset.name))continue;
    const upload=async file=>{
      checkStorage(0);noLinks(file);
      // Recheck the exact file immediately before upload. Prepared files are never trusted by name alone.
      const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),digest=createHash('sha256');let size=0;
      try {let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0){size+=n;assert(size<=asset.bytes,'upload file grew');digest.update(buffer.subarray(0,n));}}
      finally{fs.closeSync(fd);}
      assert(size===asset.bytes&&digest.digest('hex')===asset.sha256,'upload file changed after validation');
      validateAsset(await client.upload(release,asset,file),asset);checkStorage(0);
    };
    if(plan.onDemand&&asset.name!=='distribution.json') {
      await withImageDistributionChunk(plan.release,plan.input,plan.pin,asset.name,upload,{checkStorage});
    } else await upload(path.join(plan.input,asset.name));
  }
  inventory(await client.assets(release.id),plan,{complete:true});
  await requireTag(client,plan);
  release=await client.publish(release.id);validateRelease(release,plan);assert.equal(release.draft,false,'release was not published');
  await requireTag(client,plan,{required:true});
  return {publication:'PUBLISHED',releaseId:release.id,...plan.pin};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i++) {
      const key=args[i];assert(/^--(release|input|region|sha256|commit|publish|allow-incomplete|on-demand)$/.test(key)&&!Object.hasOwn(options,key),
        'invalid/duplicate publication option');
      if(key==='--publish'||key==='--allow-incomplete'||key==='--on-demand')options[key]=true;
      else {assert(args[i+1]&&!args[i+1].startsWith('--'),'missing publication option value');options[key]=args[++i];}
    }
    assert(options['--release']&&options['--input'],'--release and --input are required');
    const plan=prepareImagePublication({release:options['--release'],input:options['--input'],region:options['--region'],
      indexSha256:options['--sha256'],commit:options['--commit'],onDemand:Boolean(options['--on-demand'])});
    const result=options['--publish']?await publishPreparedImages(plan,githubImageClient(process.env.GH_TOKEN??process.env.GITHUB_TOKEN),
      {allowIncomplete:Boolean(options['--allow-incomplete'])}):{publication:'LOCAL_VALIDATION_ONLY',repository:plan.repository,
        tag:plan.tag,...plan.pin,assets:plan.assets};
    console.log(JSON.stringify(result));
  }catch(error){console.error('Image publication failed: '+error.message);process.exitCode=1;}
}
