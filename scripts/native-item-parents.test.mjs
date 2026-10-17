import assert from 'node:assert/strict';
import test from 'node:test';
import {NativeItemParents} from './native-item-parents.mjs';
function fixture() {
  const verifier=new NativeItemParents(),id='/Lotus/Base';
  const row={uniqueName:id,parentName:'',rawParent:'',selectionRule:'explicit-item-ancestry-v1',isStoreItemIdentity:true,
    values:{LocalizeTag:'/Lotus/Language/Base',LocalizeDescTag:null},fieldSources:{
      LocalizeTag:{resource:id,field:'LocalizeTag'},LocalizeDescTag:null}};
  const accept=(locale,name,sections)=>verifier.accept(`exports/${locale}/${name}.json`,{locale,sections});
  accept('neutral','ExportClientItemIdentities',{ClientItemIdentities:[{uniqueName:id}]});
  accept('neutral','ExportClientItemParents',{ClientItemParents:[row]});
  for(const locale of ['en','zh'])accept(locale,'ExportClientItemParents',{ClientItemParentLocalization:[{
    uniqueName:id,nameTag:row.values.LocalizeTag,descriptionTag:null,name:null,description:null}]});
  accept('neutral','ExportClientItemParentCoverage',{ClientItemParentCoverage:{schema:'client-item-parents-v1',parents:1,seedItems:1}});
  return {verifier,row};
}
test('complete parent capability validates independently and permits missing same-region translations',()=>fixture().verifier.verify(true));
test('parent cycles, fabricated owners, mismatched labels and missing capability files fail',()=>{
  for(const edit of [({row})=>row.parentName=row.uniqueName,({row})=>row.fieldSources.LocalizeTag.resource='/Other/Owner',
    ({verifier})=>verifier.labels.get('en').get('/Lotus/Base').nameTag='/Wrong',
    ({verifier})=>verifier.files.delete('exports/zh/ExportClientItemParents.json')]) {
    const f=fixture();edit(f);assert.throws(()=>f.verifier.verify(true));
  }
});
