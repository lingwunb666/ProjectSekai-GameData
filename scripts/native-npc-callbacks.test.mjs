import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyNpcCallbackSources} from './native-npc-callbacks.mjs';

const root='/Lotus/Agent',base='/EE/Agent',action='/Lotus/Action';
function fixture() {
  const row=(uniqueName,parentName='')=>({uniqueName,parentName,ownTextSha256:null,ownTextBytes:null,scripts:[],dependencies:[]});
  const agent=row(root,base);agent.ownTextSha256='a'.repeat(64);agent.ownTextBytes=123;
  agent.scripts=[{pointer:'/OnDamage/Script',rawTarget:''}];
  agent.dependencies=[{pointer:'/Behavior',rawTarget:'Action',resourceTarget:action,status:'RESOLVED'},
    {pointer:'/Other',rawTarget:'Missing',resourceTarget:null,status:'UNRESOLVED'}];
  return {schema:'npc-callback-declarations-v2',roots:[root],resources:[agent,row(base),row(action)]};
}
const check=proof=>verifyNpcCallbackSources(proof,[{uniqueName:root}],new Map([[root,{parentName:base}]]));
test('callback declarations support both schemas and missing optional proof without inferring runtime admission',()=>{
  check(undefined);const f=fixture();check(f);f.schema='npc-callback-declarations-v1';check(f);
});
test('callback sources reject false body proofs, malformed pointers, wrong parent and duplicate roots',()=>{
  for(const mutate of [x=>x.schema='unknown',x=>x.extra=true,x=>x.roots.push(root),x=>x.roots[0]=action,
    x=>x.resources[0].parentName='',x=>x.resources[0].ownTextSha256='bad',
    x=>x.resources[0].ownTextBytes=0,x=>x.resources[0].ownTextBytes=2*1024*1024+1,
    x=>x.resources[0].ownTextBytes=1.5,x=>x.resources[0].ownTextSha256=null,
    x=>x.resources[0].scripts[0].pointer='/bad~3/Script',x=>x.resources[0].scripts[0].pointer='/bad',
    x=>x.resources[0].scripts.push(x.resources[0].scripts[0]),
    x=>x.resources[0].dependencies[0].pointer=x.resources[0].scripts[0].pointer,
    x=>x.resources[0].dependencies[1].resourceTarget=action,
    x=>x.resources[0].dependencies[0].rawTarget='',x=>x.resources.push(x.resources[1])]) {
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
test('callback dependency closure rejects missing targets, parent cycles and unrelated records',()=>{
  for(const mutate of [x=>x.resources.pop(),x=>x.resources[0].dependencies[0].resourceTarget='/Lotus/Missing',
    x=>x.resources[1].parentName=root,
    x=>x.resources.push({...x.resources[1],uniqueName:'/Lotus/Unused'}),
    x=>x.resources[0].dependencies=[],x=>x.resources[2].parentName='/Lotus/Missing']) {
    const f=fixture();mutate(f);assert.throws(()=>check(f));
  }
});
