// Explicit public image download. No credentials, discovery via latest, database or activation.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {parseImageDistributionIndex,verifyImageDistribution,restoreImageDistribution} from './image-distribution.mjs';

const REPOSITORY='lingwunb666/ProjectSekai-GameData',MAX_INDEX=8*1024*1024,LOCK='.image-download.lock';
const digest=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
function noLinks(file) {
  for(let p=path.resolve(file);;p=path.dirname(p)) {
    const stat=fs.lstatSync(p,{throwIfNoEntry:false});assert(!stat?.isSymbolicLink(),'linked image download path is forbidden');
    if(path.dirname(p)===p)break;
  }
}
function localFile(file,{sha256,bytes,maxBytes=bytes}) {
  noLinks(file);const stat=fs.lstatSync(file);
  assert(stat.isFile()&&stat.size>0&&stat.size<=maxBytes&&(bytes===undefined||stat.size===bytes),'existing download size differs; no overwrite');
  const fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024),hash=createHash('sha256');let size=0;
  try {let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0) {
    size+=n;assert(size<=maxBytes,'existing download grew');hash.update(buffer.subarray(0,n));
  }}finally{fs.closeSync(fd);}
  assert((bytes===undefined||size===bytes)&&hash.digest('hex')===sha256,'existing download hash differs; no overwrite');
}

/** Credentials are deliberately never read or forwarded, including to the signed CDN URL. */
async function responseFor(url,fetcher,signal) {
  for(let redirects=0;;redirects++) {
    const parsed=new URL(url);
    assert(!parsed.username&&!parsed.password&&!parsed.hash&&parsed.protocol==='https:'
      &&((parsed.origin==='https://github.com'&&parsed.pathname.startsWith(`/${REPOSITORY}/releases/download/`))
        ||parsed.origin==='https://release-assets.githubusercontent.com'),'unexpected image download origin');
    let response;
    try {response=await fetcher(url,{redirect:'manual',signal,headers:{'User-Agent':'ProjectSekai-GameData-image-fetcher'}});}
    catch {throw new Error('Image download failed or timed out; complete verified chunks can be reused');}
    if([301,302,303,307,308].includes(response.status)) {
      const next=response.headers.get('location');await response.body?.cancel();
      assert(next&&redirects<3,'image download redirect bound exceeded');
      // Relative redirects are resolved, then checked on the next iteration. Never log signed URLs.
      url=new URL(next,url).href;continue;
    }
    if(response.status!==200){await response.body?.cancel();throw new Error(`Image download returned HTTP ${response.status}`);}
    assert(response.body,'image download has no body');return response;
  }
}

async function downloadFile(root,name,expected,base,fetcher) {
  const target=path.join(root,name);noLinks(target);
  if(fs.existsSync(target)){localFile(target,expected);return 'REUSED';}
  const temporary=path.join(root,`.${name}.${randomUUID()}.part`),fd=fs.openSync(temporary,'wx');
  try {
   try {
    const response=await responseFor(base+name,fetcher,AbortSignal.timeout(120_000));
    const announced=response.headers.get('content-length'),max=expected.maxBytes??expected.bytes;
    if(announced!==null) {
      const size=Number(announced);
      if(!Number.isSafeInteger(size)||size<=0||size>max||(expected.bytes!==undefined&&size!==expected.bytes)) {
        await response.body.cancel();throw new Error('Image download content length differs from pinned inventory');
      }
    }
    let size=0;const hash=createHash('sha256');
    try {
      for await(const part of response.body) {
        size+=part.length;assert(size<=max,'image download exceeds byte bound');hash.update(part);
        let at=0;while(at<part.length){const n=fs.writeSync(fd,part,at,part.length-at);assert(n>0,'short image download write');at+=n;}
      }
    }catch{throw new Error('Image download stream incomplete or exceeds pinned bounds; chunk not accepted');}
    assert(size>0&&(expected.bytes===undefined||size===expected.bytes)&&hash.digest('hex')===expected.sha256,
      'image download integrity mismatch; chunk not accepted');
    fs.fsyncSync(fd);
   }finally{fs.closeSync(fd);}
  // Hard-link is same-filesystem and exclusive: never replace an existing target on POSIX or Windows.
  // The caller removes only its own unique temporary file if this operation fails.
   fs.linkSync(temporary,target);return 'DOWNLOADED';
  }finally{fs.unlinkSync(temporary);}
}

export async function fetchImageDistribution({directory,region,distributionId,indexSha256,allowIncomplete=false},fetcher=fetch) {
  assert(['china','international'].includes(region)&&/^gad1-[a-f0-9]{24}$/.test(distributionId)
    &&digest(indexSha256),'explicit region, distribution ID and trusted index SHA-256 required');
  assert(typeof directory==='string'&&directory.trim(),'dedicated download directory required');
  const root=path.resolve(directory);noLinks(root);fs.mkdirSync(root,{recursive:true});
  assert(fs.statSync(root).isDirectory(),'download destination is not a directory');
  const lock=path.join(root,LOCK);let lockFd;
  try {lockFd=fs.openSync(lock,'wx');}catch{throw new Error('Image download directory is locked; do not run concurrent downloads or remove an active lock');}
  const initial=new Set(fs.readdirSync(root)),created=[];
  try {
    const base=`https://github.com/${REPOSITORY}/releases/download/images-${region}-${distributionId}/`;
    // Before the pinned index exists, accept only a dedicated empty directory.
    if(!initial.has('distribution.json'))assert.deepEqual([...initial],[LOCK],'download directory is not empty');
    created.push(await downloadFile(root,'distribution.json',{sha256:indexSha256,maxBytes:MAX_INDEX},base,fetcher));
    const indexFile=path.join(root,'distribution.json');localFile(indexFile,{sha256:indexSha256,maxBytes:MAX_INDEX});
    const {index}=parseImageDistributionIndex(fs.readFileSync(indexFile),{region,indexSha256});
    assert.equal(index.distributionId,distributionId,'download generation differs from requested tag');
    assert(index.chunks.length<64,'published image attachment count exceeds bound');
    assert(index.complete||allowIncomplete,'incomplete image pack requires explicit --allow-incomplete');
    const allowed=new Set([LOCK,'distribution.json',...index.chunks.map(c=>c.path)]);
    assert(fs.readdirSync(root).every(name=>allowed.has(name)),'unexpected file in image download directory');
    for(const chunk of index.chunks)created.push(await downloadFile(root,chunk.path,chunk,base,fetcher));
  }finally {
    fs.closeSync(lockFd);fs.unlinkSync(lock);
    // Complete verified chunks remain; only this invocation's unfinished temporary file is discarded.
  }
  const {index}=verifyImageDistribution(root,{region,indexSha256});
  return {download:'VERIFIED_DISTRIBUTION',region,distributionId,indexSha256,
    assetReleaseId:index.assetReleaseId,manifestSha256:index.manifestSha256,complete:index.complete,
    downloaded:created.filter(s=>s==='DOWNLOADED').length,reused:created.filter(s=>s==='REUSED').length,activation:'NOT_ACTIVATED'};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {
    const args=process.argv.slice(2),options={};
    for(let i=0;i<args.length;i++) {
      const key=args[i];assert(/^--(directory|region|distribution|sha256|restore|allow-incomplete)$/.test(key)
        &&!Object.hasOwn(options,key),'invalid/duplicate image download option');
      if(key==='--allow-incomplete')options[key]=true;
      else {assert(args[i+1]&&!args[i+1].startsWith('--'),'image download option value required');options[key]=args[++i];}
    }
    if(options['--restore']){noLinks(options['--restore']);assert(!fs.existsSync(options['--restore']),'restore output must be a NEW directory');}
    const result=await fetchImageDistribution({directory:options['--directory'],region:options['--region'],
      distributionId:options['--distribution'],indexSha256:options['--sha256'],allowIncomplete:Boolean(options['--allow-incomplete'])});
    if(options['--restore'])result.restored=restoreImageDistribution(options['--directory'],options['--restore'],
      {region:result.region,indexSha256:result.indexSha256});
    console.log(JSON.stringify(result));
  }catch(error){console.error('Image download failed: '+error.message);process.exitCode=1;}
}
