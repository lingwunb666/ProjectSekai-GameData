import assert from 'node:assert/strict';
import {verifyScopedLinks} from './native-scoped-links.mjs';
import {verifyNpcCallbackSources} from './native-npc-callbacks.mjs';

const baseKinds=['ClientNpcAgents','ClientNpcAvatars','ClientNpcDamageControllers','ClientNpcHitProxies'];
const definitionFields={ClientNpcInjuryHandlers:['DeathInjuryType','DeathEffectType','EvaluatorTypes','ImpulseThreshold'],
  ClientNpcInjuryEvaluators:['DamageTypes']};
const sourceTypeFields=['InvalidDamageSourceEntities','ValidDamageSourceEntities'];
const resource=id=>typeof id==='string'&&/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(id)
  &&id.split('/').every(p=>p!=='.'&&p!=='..');
const nullableText=x=>x===null||typeof x==='string';
const handlerFields=new Set(['InjuryHandlersEx','PainHandler','PreDeathHandler','DeathHandler']);

function ancestryInventory(inventory,allowed,declared) {
  if(inventory===undefined)return;
  assert(inventory&&typeof inventory==='object'&&!Array.isArray(inventory),'NPC ancestry inventory');
  for(const [kind,fields]of Object.entries(inventory)) {
    assert(Object.hasOwn(allowed,kind)&&Array.isArray(declared[kind]),'NPC ancestry kind');
    assert(Array.isArray(fields)&&fields.length<=allowed[kind].length&&new Set(fields).size===fields.length,'NPC ancestry fields');
    for(const field of fields)assert(allowed[kind].includes(field)&&declared[kind].includes(field),'NPC undeclared ancestry field');
  }
}

/** Generic metadata view uses the nearest WHOLE field. Not a native handler-map merge. */
export function npcView(sections,fields,kind,id) {
  const resources=new Map(sections.ClientNpcResources.map(row=>[row.uniqueName,row]));
  const chain=[],seen=new Set();let current=id;
  while(current) {
    assert(chain.length<100&&!seen.has(current),'NPC cycle/depth');seen.add(current);
    const row=resources.get(current);assert(row,'Missing NPC parent');chain.push(row);current=row.parentName;
  }
  const values={},fieldSources={},references=[];
  for(const field of fields[kind]) {
    const owner=chain.find(r=>Object.hasOwn(r.values,field));
    values[field]=owner?owner.values[field]:null;
    fieldSources[field]=owner?{resource:owner.uniqueName,field}:null;
    if(owner)references.push(...owner.references.filter(r=>r.pointer.split('/')[2]===field));
  }
  return {uniqueName:id,resourceChain:chain.map(r=>r.uniqueName),values,fieldSources,references};
}

export class NativeNpc {
  #sections;#coverage;
  accept(path,data) {
    if(path==='exports/neutral/ExportClientNpc.json') {
      assert(!this.#sections&&data.locale==='neutral');this.#sections=data.sections;
    }
    if(path==='exports/neutral/ExportClientNpcCoverage.json') {
      assert(!this.#coverage&&data.locale==='neutral');this.#coverage=data.sections.ClientNpcCoverage;
    }
    for(const key of Object.keys(data.sections??{}))if(key.startsWith('ClientNpc'))
      assert(path===(key==='ClientNpcCoverage'?'exports/neutral/ExportClientNpcCoverage.json':'exports/neutral/ExportClientNpc.json'),'NPC artifact path');
  }
  verify(required) {
    if(!required&&!this.#sections&&!this.#coverage)return;
    const sections=this.#sections,coverage=this.#coverage;
    assert(sections&&coverage,'Incomplete NPC capability');
    assert.equal(coverage.schema,'client-npc-facts-v1');assert.equal(coverage.encoding,'native-npc-owned-values-v1');
    assert.equal(coverage.selectionRoot,'/EE/Types/Npc/NpcAgent');assert(Array.isArray(coverage.issues));
    const kinds=[...baseKinds];
    if(Object.keys(definitionFields).some(kind=>Object.hasOwn(sections,kind)))kinds.push(...Object.keys(definitionFields));
    assert.deepEqual(Object.keys(sections).sort(),[...kinds,'ClientNpcResources'].sort());
    assert.deepEqual(Object.keys(coverage.fields).sort(),kinds.slice().sort());
    const allowed=new Set();
    for(const kind of kinds) {
      assert(Array.isArray(coverage.fields[kind])&&coverage.fields[kind].length>0&&coverage.fields[kind].length<=64);
      assert.equal(new Set(coverage.fields[kind]).size,coverage.fields[kind].length);
      for(const field of coverage.fields[kind]){assert(/^[A-Za-z][A-Za-z0-9]*$/.test(field));allowed.add(field);}
    }
    if(coverage.ancestryReferences!==undefined) {
      const inventory=coverage.ancestryReferences;
      assert(inventory&&typeof inventory==='object'&&!Array.isArray(inventory),'NPC ancestry reference inventory');
      assert(Object.keys(inventory).every(k=>k==='ClientNpcDamageControllers'),'NPC ancestry reference kind');
      const fields=inventory.ClientNpcDamageControllers;
      if(fields!==undefined) {
        assert(Array.isArray(fields)&&fields.length<=4&&new Set(fields).size===fields.length,'NPC ancestry reference fields');
        for(const field of fields)assert(handlerFields.has(field)&&coverage.fields.ClientNpcDamageControllers.includes(field),
          'NPC ancestry reference field outside declared inventory');
      }
    }
    ancestryInventory(coverage.ancestryDefinitions,definitionFields,coverage.fields);
    ancestryInventory(coverage.ancestryScriptReferences,{ClientNpcAvatars:['OnDamageScript']},coverage.fields);
    ancestryInventory(coverage.ancestrySourceTypeLists,{ClientNpcDamageControllers:sourceTypeFields},coverage.fields);
    assert(Array.isArray(sections.ClientNpcResources)&&sections.ClientNpcResources.length>0&&sections.ClientNpcResources.length<=32768);
    const resources=new Map();
    for(const row of sections.ClientNpcResources) {
      assert(resource(row.uniqueName)&&!resources.has(row.uniqueName));resources.set(row.uniqueName,row);
      assert(row.parentName===''||resource(row.parentName));assert(row.values&&typeof row.values==='object'&&!Array.isArray(row.values));
      assert.equal(row.referenceRule,'native-declaration-scope-v2');
      for(const key of Object.keys(row.values))assert(allowed.has(key),'Undeclared NPC field');
      for(const field of sourceTypeFields)if(Object.hasOwn(row.values,field))
        assert(Array.isArray(row.values[field])&&row.values[field].length<=256
          &&row.values[field].every(value=>typeof value==='string'),'NPC source-type array');
    }
    assert.equal(coverage.resources,resources.size);verifyScopedLinks(sections);
    const used=new Set();
    for(const kind of kinds) {
      const rows=sections[kind];assert(Array.isArray(rows)&&rows.length<=16384);assert.equal(coverage.sections[kind],rows.length);
      const ids=new Set();
      for(const row of rows) {
        assert(resource(row.uniqueName)&&!ids.has(row.uniqueName));ids.add(row.uniqueName);
        assert.equal(row.selectionRule,'native-npc-reference-closure-v1');
        let current=row.uniqueName;const seen=new Set();
        while(current) {
          assert(!seen.has(current)&&seen.size<100,'NPC cycle/depth');seen.add(current);used.add(current);
          const parent=resources.get(current);assert(parent,'Missing NPC parent');current=parent.parentName;
        }
        if(kind==='ClientNpcAgents')assert(seen.has(coverage.selectionRoot),'Wrong NPC agent root');
        if(kind==='ClientNpcAvatars')for(const locale of ['en','zh']) {
          const text=row.localizations?.[locale];assert(text);
          for(const field of ['name','description','longDescription'])assert(nullableText(text[field]));
        }
      }
    }
    assert.equal(used.size,resources.size,'Unreferenced NPC declarations');
    verifyNpcCallbackSources(coverage.callbackSources,sections.ClientNpcAgents,resources);
  }
}
