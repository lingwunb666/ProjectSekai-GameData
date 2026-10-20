import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyScopedLinks} from './native-scoped-links.mjs';
function fixture(){return {ClientSyndicates:[{referenceRule:'native-declaration-scope-v2',
  values:{Titles:[{rewards:[{ItemType:'Currency'}]}]},fieldSources:{Titles:{resource:'/Lotus/Parent'}},
  references:[{pointer:'/values/Titles/0/rewards/0/ItemType',rawTarget:'Currency',owner:'/Lotus/Parent',
    resourceTarget:'/Lotus/Currency',status:'RESOLVED'}]}]};}

test('inventory store object links and item scalar links stay distinct and cannot omit their rule',()=>{
  const store='/Lotus/StoreItems/Skin',item='/Lotus/Skin',layer=(id,isStore)=>({uniqueName:id,
    referenceRule:'native-declaration-scope-v2',values:{AdditionalItems:isStore?[{TypeName:'Other',PurchaseQuantity:2}]:['Other']},
    fieldSources:{AdditionalItems:{resource:id,field:'AdditionalItems'}},references:[{pointer:'/values/AdditionalItems/0'+(isStore?'/TypeName':''),
      owner:id,rawTarget:'Other',resourceTarget:isStore?'/Lotus/StoreItems/Other':'/Lotus/Other',status:'RESOLVED'}]});
  const row={uniqueName:store,itemTarget:item,rule:'native-inventory-details-v1',store:layer(store,true),item:layer(item,false)};
  verifyScopedLinks({ClientInventoryDetails:[row]});row.store.references=[];
  assert.throws(()=>verifyScopedLinks({ClientInventoryDetails:[row]}),/Missing/);
  delete row.store.referenceRule;assert.throws(()=>verifyScopedLinks({ClientInventoryDetails:[row]}));
});

test('robotic and beast companions require exact default weapon declaration scope',()=>{
  for(const section of ['ClientCompanionPowerSuits','ClientPetPowerSuits']) {
    const row={referenceRule:'native-declaration-scope-v2',values:{DefaultWeapon:'Gun'},
      fieldSources:{DefaultWeapon:{resource:'/Lotus/Parent',field:'DefaultWeapon'}},
      references:[{pointer:'/values/DefaultWeapon',rawTarget:'Gun',owner:'/Lotus/Parent',resourceTarget:'/Lotus/Gun',status:'RESOLVED'}]};
    verifyScopedLinks({[section]:[row]});row.references[0].owner='/Lotus/Child';assert.throws(()=>verifyScopedLinks({[section]:[row]}));
    row.references=[];assert.throws(()=>verifyScopedLinks({[section]:[row]}),/Missing/);
  }
});
test('mail attachments retain their declaring message scope and cannot omit a link',()=>{
  const row={referenceRule:'native-declaration-scope-v2',values:{Message:{att:['Gift']}},
    fieldSources:{Message:{resource:'/Lotus/Mail/Base',field:'Message'}},
    references:[{pointer:'/values/Message/att/0',rawTarget:'Gift',owner:'/Lotus/Mail/Base',resourceTarget:'/Lotus/Mail/Gift',status:'RESOLVED'}]};
  verifyScopedLinks({ClientEmailItems:[row]});row.references[0].owner='/Lotus/Mail/Child';
  assert.throws(()=>verifyScopedLinks({ClientEmailItems:[row]}));
  row.references=[];assert.throws(()=>verifyScopedLinks({ClientEmailItems:[row]}),/Missing/);
});
test('nested fields bind to the whole declaring owner and omitted links fail',()=>{
  const f=fixture();verifyScopedLinks(f);
  f.ClientSyndicates[0].references[0].owner='/Lotus/Child';assert.throws(()=>verifyScopedLinks(f));
  f.ClientSyndicates[0].references=[];assert.throws(()=>verifyScopedLinks(f),/Missing/);
});
test('ordered extra syndicate reward manifests retain exact declaring scope and cannot omit or duplicate links',()=>{
  const row={uniqueName:'/Lotus/Syndicates/Child',referenceRule:'native-declaration-scope-v2',
    values:{ExtraJobRewardManifests:['PoolA','PoolB']},fieldSources:{ExtraJobRewardManifests:{resource:'/Lotus/Syndicates/Base'}},
    references:['PoolA','PoolB'].map((rawTarget,i)=>({pointer:'/values/ExtraJobRewardManifests/'+i,rawTarget,
      owner:'/Lotus/Syndicates/Base',resourceTarget:'/Lotus/Syndicates/'+rawTarget,status:'RESOLVED'}))};
  verifyScopedLinks({ClientSyndicates:[row]});
  const wrong=structuredClone(row);wrong.references[0].owner=row.uniqueName;
  assert.throws(()=>verifyScopedLinks({ClientSyndicates:[wrong]}));
  const duplicate=structuredClone(row);duplicate.references.push(duplicate.references[0]);
  assert.throws(()=>verifyScopedLinks({ClientSyndicates:[duplicate]}),/Unknown\/duplicate/);
  row.references.pop();assert.throws(()=>verifyScopedLinks({ClientSyndicates:[row]}),/Missing/);
});
test('legacy v1 is not retroactively required to have new v2 rank links',()=>{
  const f=fixture();f.ClientSyndicates[0].referenceRule='native-declaration-scope-v1';f.ClientSyndicates[0].references=[];
  verifyScopedLinks(f);
});
test('player suits require every ordered ability and historical default-card reference',()=>{
  const row={referenceRule:'native-declaration-scope-v2',values:{AbilityTypes:['Ability'],DefaultSlottedUpgrades:[{ItemType:'OldCard',Slot:9}]},
    fieldSources:{AbilityTypes:{resource:'/Lotus/Base'},DefaultSlottedUpgrades:{resource:'/Lotus/Base'}},
    references:[{pointer:'/values/AbilityTypes/0',rawTarget:'Ability',owner:'/Lotus/Base',resourceTarget:'/Lotus/Ability',status:'RESOLVED'},
      {pointer:'/values/DefaultSlottedUpgrades/0/ItemType',rawTarget:'OldCard',owner:'/Lotus/Base',resourceTarget:null,status:'UNRESOLVED'}]};
  verifyScopedLinks({ClientPlayerPowerSuits:[row]});row.references.pop();assert.throws(()=>verifyScopedLinks({ClientPlayerPowerSuits:[row]}),/Missing/);
});

test('focus parent and tree links require provenance and preserve unresolved or explicitly empty values',()=>{
  for(const section of ['ClientFocusUpgrades','ClientFocusAbilities']) {
    const row={referenceRule:'native-declaration-scope-v2',values:{ParentAbility:'Parent'},
      fieldSources:{ParentAbility:{resource:'/Lotus/Base',field:'ParentAbility'}},
      references:[{pointer:'/values/ParentAbility',rawTarget:'Parent',owner:'/Lotus/Base',resourceTarget:'/Lotus/Parent',status:'RESOLVED'}]};
    if(section==='ClientFocusAbilities'){
      row.values.BaseTree='Missing';row.fieldSources.BaseTree={resource:'/Lotus/Base',field:'BaseTree'};
      row.references.push({pointer:'/values/BaseTree',rawTarget:'Missing',owner:'/Lotus/Base',resourceTarget:null,status:'UNRESOLVED'});
    }
    verifyScopedLinks({[section]:[row]});
    row.references.shift();assert.throws(()=>verifyScopedLinks({[section]:[row]}),/Missing/);
    row.values.ParentAbility='';verifyScopedLinks({[section]:[row]});
  }
});

test('bundle and random-pack references require all component declarations and preserve unresolved targets',()=>{
  for(const [section,field,key]of [['ClientBundles','PackageComponents','TypeName'],
    ['ClientBoosterPacks','Components','Item'],['ClientBoosterPacks','RARE_Components','Item']]) {
    const row={referenceRule:'native-declaration-scope-v2',values:{[field]:[{[key]:'Relative'}]},
      fieldSources:{[field]:{resource:'/Lotus/Parent',field}},references:[{pointer:`/values/${field}/0/${key}`,
        rawTarget:'Relative',owner:'/Lotus/Parent',status:'RESOLVED',resourceTarget:'/Lotus/StoreItems/Actual'}]};
    verifyScopedLinks({[section]:[row]});
    row.references[0].status='UNRESOLVED';row.references[0].resourceTarget=null;
    verifyScopedLinks({[section]:[row]});
    row.references[0].owner='/Lotus/Child';assert.throws(()=>verifyScopedLinks({[section]:[row]}));
    row.references=[];assert.throws(()=>verifyScopedLinks({[section]:[row]}),/Missing/);
  }
});
