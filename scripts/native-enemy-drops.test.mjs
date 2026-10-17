import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeEnemyDrops} from './native-enemy-drops.mjs';

const artifact='exports/neutral/ExportClientEnemyDropTables.json',schema='client-enemy-drop-tables-v1';
const categories=['DROP_AMMO','DROP_BLUEPRINT','DROP_MISC_ITEM','DROP_MOD','DROP_POWERUP','DROP_SIGIL','DROP_VOID_PROJECTION','DROP_FUSION_ORNAMENT'];
function fixture() {
  const source={resource:'/Lotus/Table',cache:'H.Misc',tocSha256:'a'.repeat(64),compressedSha256:'b'.repeat(64),decodedSha256:'c'.repeat(64),bytes:49,stamp:'1'};
  const row={uniqueName:source.resource,familyRoot:'/Lotus/Types/Game/LotusDropTable',format:schema,bodySha256:'d'.repeat(64),
    exactEnd:true,exactBodyRoundTrip:true,source,categories:categories.map(category=>({category,stripped:true,body:null})),
    strippedItemType:'/Lotus/Stripped',ignoreGameModeDrops:false,defaultPickUps:Object.fromEntries(categories.map(c=>[c,''])),
    defaultRareBiasAtten:Object.fromEntries(categories.map(c=>[c,{rareBiasMin:0,rareBiasMax:0,rareAttenMin:0,rareAttenMax:0,levelRange:[0,100]}])),
    spawnOffset:[0,1.5,0,0],upForce:[5,10],sideForce:[1,2]};
  return {data:{region:'china',locale:'neutral',sections:{ClientEnemyDropTableContents:[row],
    ClientEnemyDropTableCoverage:{schema,registered:1,withoutResource:[],requested:1,decoded:1,strippedCategories:8,entries:0,issues:[]}}},
    manifest:{region:'china',capabilities:[schema],clientExtraction:{sourceRecords:[structuredClone(source)]}}};
}
test('stripped bodies remain unavailable and require exact same-region source provenance',()=>{
  const {data,manifest}=fixture(),v=new NativeEnemyDrops();v.accept(artifact,data);v.verify(manifest);
  assert.throws(()=>v.accept(artifact,data));assert.throws(()=>v.verify({...manifest,region:'international'}));
  manifest.clientExtraction.sourceRecords[0].decodedSha256='f'.repeat(64);assert.throws(()=>v.verify(manifest));
});
test('invented bodies and mismatched counts are rejected, with historical absence still allowed',()=>{
  new NativeEnemyDrops().verify({region:'china',capabilities:[]});
  assert.throws(()=>new NativeEnemyDrops().verify({region:'china',capabilities:[schema]}));
  for(const mutate of [d=>d.sections.ClientEnemyDropTableContents[0].categories[0].body={},
    d=>d.sections.ClientEnemyDropTableCoverage.entries=1,
    d=>d.sections.ClientEnemyDropTableCoverage.withoutResource=['/Lotus/Table']]) {
    const {data,manifest}=fixture();mutate(data);const v=new NativeEnemyDrops();v.accept(artifact,data);assert.throws(()=>v.verify(manifest));
  }
});
