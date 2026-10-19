// Limit CI worktree size, not release validation depth or Git publication history.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const regions=['international','china'];
const digest=value=>createHash('sha256').update(value).digest('hex');
function git(...args) {
  const r=spawnSync('git',['-C',root,...args],{encoding:'utf8',timeout:120000,maxBuffer:8*1024*1024,
    windowsHide:true,env:{...process.env,GIT_TERMINAL_PROMPT:'0'}});
  assert.equal(r.status,0,'Git '+args[0]+' failed; no checkout changes applied by planner');
  return r.stdout;
}
function lines(value) {return value.trim().split('\n').filter(Boolean);}
export function planCiCheckout(readGit=git) {
  assert.equal(readGit('rev-parse','--is-shallow-repository').trim(),'false','Full pointer history required');
  const head=readGit('rev-parse','HEAD').trim();
  assert(/^[a-f0-9]{40}$/.test(head),'Invalid revision');
  const entries=readGit('ls-tree','-z',head).split('\0').filter(Boolean).map(row=>{
    const [metadata,name]=row.split('\t');return {mode:metadata.split(' ')[0],name};
  });
  assert(entries.every(e=>/^[A-Za-z0-9_.-]+$/.test(e.name)&&['040000','100644','100755'].includes(e.mode)),
    'Unknown or linked root entry');
  const directories=entries.filter(e=>e.mode==='040000'&&e.name!=='datasets').map(e=>e.name);
  assert(directories.includes('scripts')&&directories.includes('.github'),'Verification sources required');
  assert(lines(readGit('ls-tree','--name-only',head+':datasets')).every(name=>regions.includes(name)),'Unknown region');
  const retained=[];
  for(const region of regions) {
    const regional=lines(readGit('ls-tree','--name-only',head+':datasets/'+region));
    assert(regional.every(name=>['releases','latest.json','status.json'].includes(name)),'Unknown regional entry');
    if(!regional.includes('latest.json'))continue; // A region may still be explicitly unavailable.
    const pointerPath='datasets/'+region+'/latest.json',seen=new Set();
    const revisions=lines(readGit('log','-1000','--format=%H',head,'--',pointerPath));
    assert(revisions.length,'Missing pointer history');
    for(const commit of revisions) {
      assert(/^[a-f0-9]{40}$/.test(commit),'Invalid pointer revision');
      const pointer=JSON.parse(readGit('show',commit+':'+pointerPath));
      assert.equal(pointer.schemaVersion,1);
      assert.equal(pointer.region,region);
      assert(/^gd1-[a-f0-9]{24}$/.test(pointer.releaseId),'Invalid release');
      const directory='datasets/'+region+'/releases/'+pointer.releaseId;
      assert.equal(pointer.manifest,directory+'/manifest.json');
      assert(/^[a-f0-9]{64}$/.test(pointer.manifestSha256),'Invalid manifest digest');
      if(seen.has(pointer.releaseId))continue;
      const bytes=readGit('show',head+':'+pointer.manifest);
      assert.equal(digest(bytes),pointer.manifestSha256,'Published manifest changed or wrong pin');
      const manifest=JSON.parse(bytes);
      assert.equal(manifest.region,region);assert.equal(manifest.releaseId,pointer.releaseId);
      if(seen.size===0)assert.equal(readGit('show',head+':'+pointerPath),readGit('show',commit+':'+pointerPath),'Latest pointer mismatch');
      seen.add(pointer.releaseId);directories.push(directory);
      retained.push({region,releaseId:pointer.releaseId,manifestSha256:pointer.manifestSha256});
      if(seen.size===2)break;
    }
  }
  return {schemaVersion:1,head,directories,retained,history:'UNCHANGED',
    verification:'FULL_CONTENT_CHECKS_FOR_EACH_SELECTED_RELEASE_NOT_ALL_HISTORICAL_RELEASES'};
}
export function applyCiCheckout(plan,readGit=git,actions=process.env.GITHUB_ACTIONS) {
  assert.equal(actions,'true','Apply is restricted to the ephemeral GitHub Actions workspace');
  assert.equal(readGit('status','--porcelain','--untracked-files=all','--ignored=matching').trim(),'','Dirty CI workspace');
  assert.equal(readGit('rev-parse','HEAD').trim(),plan.head,'Revision changed after planning');
  readGit('sparse-checkout','set','--cone','--',...plan.directories);
  assert.equal(readGit('rev-parse','HEAD').trim(),plan.head,'Revision changed during checkout');
  assert.equal(readGit('status','--porcelain','--untracked-files=all','--ignored=matching').trim(),'','Dirty CI workspace after checkout');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const args=process.argv.slice(2);
  assert(args.length===0||args.length===1&&args[0]==='--apply','Usage: node scripts/ci-checkout.mjs [--apply]');
  const plan=planCiCheckout();
  if(args[0])applyCiCheckout(plan);
  console.log(JSON.stringify(plan,null,2));
}
