import assert from 'node:assert/strict';

const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
function shape(value,keys) {
  assert(object(value),'Callback object');assert.deepEqual(Object.keys(value).sort(),keys.slice().sort(),'Callback shape');
}
function text(value) {assert(typeof value==='string'&&value.length<=4096,'Callback text');return value;}
function identity(value) {
  text(value);assert(/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(value)
    &&value.split('/').every(part=>part!=='.'&&part!=='..'),'Callback identity');return value;
}
function pointer(value) {text(value);assert(value.startsWith('/')&&!/~(?:[^01]|$)/.test(value),'Callback pointer');return value;}

/** Declaration provenance only; neither script execution nor combat admission. */
export function verifyNpcCallbackSources(proof,agents,ordinary) {
  if(proof===undefined)return;
  shape(proof,['schema','roots','resources']);
  assert(['npc-callback-declarations-v1','npc-callback-declarations-v2'].includes(proof.schema),'Callback schema');
  assert(Array.isArray(proof.roots)&&proof.roots.length>0&&proof.roots.length<=16
    &&Array.isArray(proof.resources)&&proof.resources.length>0&&proof.resources.length<=512,'Callback bounds');
  const resources=new Map(),edges=new Map();let bytes=0;
  for(const row of proof.resources) {
    shape(row,['uniqueName','parentName','ownTextSha256','ownTextBytes','scripts','dependencies']);
    const id=identity(row.uniqueName),parent=text(row.parentName);if(parent)identity(parent);
    assert(!resources.has(id),'Duplicate callback resource');resources.set(id,row);
    if(ordinary.has(id))assert.equal(ordinary.get(id).parentName,parent,'Callback parent mismatch');
    const hash=row.ownTextSha256,size=row.ownTextBytes;
    assert(hash===null?size===null:typeof hash==='string'&&/^[a-f0-9]{64}$/.test(hash)
      &&Number.isInteger(size)&&size>=0&&size<=2*1024*1024,'Callback body proof');
    bytes+=size??0;assert(bytes<=16*1024*1024,'Callback total bytes');
    assert(Array.isArray(row.scripts)&&row.scripts.length<=512
      &&Array.isArray(row.dependencies)&&row.dependencies.length<=256,'Callback field bounds');
    if(hash===null||size===0)assert(row.scripts.length===0&&row.dependencies.length===0,'Absent callback body declares fields');
    const pointers=new Set(),targets=parent?[parent]:[];
    for(const script of row.scripts) {
      shape(script,['pointer','rawTarget']);const p=pointer(script.pointer);
      assert((p.endsWith('/Script')||p.endsWith(':Script'))&&!pointers.has(p),'Invalid/duplicate script pointer');
      pointers.add(p);text(script.rawTarget);
    }
    for(const dependency of row.dependencies) {
      shape(dependency,['pointer','rawTarget','resourceTarget','status']);const p=pointer(dependency.pointer);
      assert(!pointers.has(p)&&text(dependency.rawTarget)!=='','Callback dependency pointer/value');pointers.add(p);
      if(dependency.status==='RESOLVED')targets.push(identity(dependency.resourceTarget));
      else assert(dependency.status==='UNRESOLVED'&&dependency.resourceTarget===null,'Callback dependency status');
    }
    edges.set(id,targets);
  }
  for(const row of resources.values()) {
    let current=row.uniqueName;const seen=new Set();
    while(current) {
      assert(seen.size<100&&!seen.has(current)&&resources.has(current),'Callback parent chain');
      seen.add(current);current=resources.get(current).parentName;
    }
  }
  const agentIds=new Set(agents.map(row=>row.uniqueName)),roots=new Set(),used=new Set(),pending=[];
  for(const root of proof.roots) {
    identity(root);assert(agentIds.has(root)&&resources.has(root)&&!roots.has(root),'Callback agent root');roots.add(root);pending.push(root);
  }
  while(pending.length) {
    const id=pending.pop();assert(resources.has(id),'Missing callback dependency');
    if(!used.has(id)){used.add(id);pending.push(...edges.get(id));}
  }
  assert.equal(used.size,resources.size,'Unreferenced callback sources');
}
