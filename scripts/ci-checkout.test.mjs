import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planCiCheckout,applyCiCheckout} from './ci-checkout.mjs';

function fixture() {
  const head='a'.repeat(40),older='b'.repeat(40),previous='c'.repeat(40),ancient='d'.repeat(40);
  const values=new Map(),calls=[];
  const put=(args,value)=>values.set(JSON.stringify(args),value);
  put(['rev-parse','--is-shallow-repository'],'false\n');
  put(['rev-parse','HEAD'],head+'\n');
  put(['ls-tree','-z',head],'040000 tree x\t.github\0'+'040000 tree x\tscripts\0'+'040000 tree x\tdatasets\0'+'100644 blob x\tREADME.md\0');
  put(['ls-tree','--name-only',head+':datasets'],'international\nchina\n');
  for(const region of ['international','china']) {
    put(['ls-tree','--name-only',head+':datasets/'+region],'latest.json\nreleases\nstatus.json\n');
    put(['log','-1000','--format=%H',head,'--','datasets/'+region+'/latest.json'],[head,older,previous,ancient].join('\n'));
    for(const [commit,version]of [[head,3],[older,3],[previous,2],[ancient,1]]) {
      const releaseId='gd1-'+String(version).repeat(24),directory='datasets/'+region+'/releases/'+releaseId;
      const manifest=JSON.stringify({region,releaseId})+'\n';
      const pointer=JSON.stringify({schemaVersion:1,region,releaseId,manifest:directory+'/manifest.json',
        manifestSha256:createHash('sha256').update(manifest).digest('hex')})+'\n';
      put(['show',commit+':datasets/'+region+'/latest.json'],pointer);
      put(['show',head+':'+directory+'/manifest.json'],manifest);
    }
  }
  put(['status','--porcelain','--untracked-files=all','--ignored=matching'],'');
  const git=(...args)=>{
    calls.push(args);
    if(args[0]==='sparse-checkout')return '';
    const key=JSON.stringify(args);assert(values.has(key),'unexpected Git call '+key);return values.get(key);
  };
  return {head,values,calls,put,git};
}
test('selects two distinct published pins per region without reading ancient releases',()=>{
  const f=fixture(),plan=planCiCheckout(f.git);
  assert.equal(plan.retained.length,4);
  assert.deepEqual(plan.retained.map(x=>x.releaseId),[3,2,3,2].map(n=>'gd1-'+String(n).repeat(24)));
  assert.equal(plan.directories.length,6);
  assert.equal(plan.history,'UNCHANGED');
  assert(f.calls.every(args=>!args.join(' ').includes('gd1-'+'1'.repeat(24))));
  assert(f.calls.every(args=>args[0]!=='sparse-checkout'));
});
test('rejects shallow history and any changed manifest before checkout',()=>{
  const f=fixture();f.put(['rev-parse','--is-shallow-repository'],'true\n');
  assert.throws(()=>planCiCheckout(f.git),/Full pointer history/);
  const g=fixture();g.put(['show',g.head+':datasets/international/releases/gd1-'+'3'.repeat(24)+'/manifest.json'],'{}\n');
  assert.throws(()=>planCiCheckout(g.git),/Published manifest changed/);
  assert(g.calls.every(args=>args[0]!=='sparse-checkout'));
});
test('rejects cross-region pointers and unreviewed dataset folders',()=>{
  const f=fixture(),key=['show',f.head+':datasets/international/latest.json'];
  const pointer=JSON.parse(f.git(...key));pointer.region='china';f.put(key,JSON.stringify(pointer)+'\n');
  assert.throws(()=>planCiCheckout(f.git));
  const g=fixture();g.put(['ls-tree','--name-only',g.head+':datasets/china'],'latest.json\nprivate\nreleases\n');
  assert.throws(()=>planCiCheckout(g.git),/Unknown regional entry/);
});
test('apply needs an unchanged clean ephemeral Actions workspace',()=>{
  const f=fixture(),plan=planCiCheckout(f.git);
  assert.throws(()=>applyCiCheckout(plan,f.git,'false'),/restricted/);
  f.put(['status','--porcelain','--untracked-files=all','--ignored=matching'],'?? personal-note.txt\n');
  assert.throws(()=>applyCiCheckout(plan,f.git,'true'),/Dirty CI/);
  assert(f.calls.every(args=>args[0]!=='sparse-checkout'));
  f.put(['status','--porcelain','--untracked-files=all','--ignored=matching'],'');
  applyCiCheckout(plan,f.git,'true');
  assert.deepEqual(f.calls.filter(args=>args[0]==='sparse-checkout'),[['sparse-checkout','set','--cone','--',...plan.directories]]);
});
test('first publication and an explicitly unavailable region need no invented predecessor',()=>{
  const f=fixture();
  f.put(['ls-tree','--name-only',f.head+':datasets/china'],'status.json\n');
  f.put(['log','-1000','--format=%H',f.head,'--','datasets/international/latest.json'],f.head+'\n');
  const plan=planCiCheckout(f.git);
  assert.equal(plan.retained.length,1);assert.equal(plan.retained[0].region,'international');
});
