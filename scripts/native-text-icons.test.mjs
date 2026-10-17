import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeTextIcons} from './native-text-icons.mjs';
const material='/EE/Types/GraphicsRes/Material';
function fixture() {
  return {ClientTextIconCollections:['IconCollection','EmoticonCollection'].map(field=>{
    const id='/Lotus/UI/'+field;
    return {uniqueName:id,familyRoot:'/EE/Types/GraphicsRes/PlatformIconCollection',
      selection:{resource:'/Lotus/GameConfig',field,rawTarget:id,resourceTarget:id,status:'RESOLVED'},
      fieldSources:{Icons:{resource:id,field:'Icons'}},
      values:{Icons:[{Name:'CREDIT',Platforms:[{IconPlatform:'DIT_PC',Material:material}]}]},
      bindings:[{name:'CREDIT',platform:'DIT_PC',pointer:'/values/Icons/0/Platforms/0/Material',owner:id,
        rawTarget:material,resourceTarget:material,status:'RESOLVED'}]};
  }),ClientTextIconMaterials:[{uniqueName:material,resourceChain:[material],completeAttributeChain:true,
    layers:[{resource:material,kind:'PACKAGE_ATTRIBUTES',textureAttributes:{'TX:DiffuseMap':''}}],
    textureFields:[{field:'TX:DiffuseMap',owner:material,rawTarget:'',resourceTarget:null,status:'EMPTY_OVERRIDE'}]}]};
}
function verify(data) {
  const verifier=new NativeTextIcons();
  verifier.accept('exports/neutral/ExportClientTextIconCoverage.json',{sections:{ClientTextIconCoverage:{
    schema:'client-text-icons-v1',collections:2,names:2,bindings:2,materials:1}}});
  verifier.accept('exports/neutral/ExportClientTextIcons.json',{sections:data});verifier.verify(true);
}
test('raw collection bindings and explicit empty texture verify in either file order',()=>verify(fixture()));
test('misbound platform, omitted material and invented inherited texture are rejected',()=>{
  let f=fixture();f.ClientTextIconCollections[0].bindings[0].platform='DIT_AUTO';assert.throws(()=>verify(f));
  f=fixture();f.ClientTextIconMaterials=[];assert.throws(()=>verify(f));
  f=fixture();Object.assign(f.ClientTextIconMaterials[0].textureFields[0],{
    rawTarget:'invented.png',resourceTarget:'/Lotus/invented.png',status:'RESOLVED'});assert.throws(()=>verify(f));
});
test('capability without either file is rejected',()=>assert.throws(()=>new NativeTextIcons().verify(true)));
