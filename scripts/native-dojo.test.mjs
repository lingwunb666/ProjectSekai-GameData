import test from 'node:test';
import assert from 'node:assert/strict';
import {NativeDojo} from './native-dojo.mjs';

function fixture(){return {locale:'neutral',sections:{ClientDojoRecipes:[{
  uniqueName:'/Lotus/Deco',selectionRule:'dojo-manifest-class-v1',manifest:'/Lotus/Types/Game/Store/DojoRecipeManifest',
  familyRoot:'/Lotus/Types/Game/DojoDecorationRecipeItem',roles:['DECOS','RESEARCH'],
  values:{IsResearch:1,ResearchIngredients:[{ItemType:'Ore',ItemCount:200}]},fieldSources:{ResearchIngredients:'/Lotus/Base'},
  referenceRule:'native-declaration-scope-v1',references:[{pointer:'/values/ResearchIngredients/0/ItemType',
    rawTarget:'Ore',owner:'/Lotus/Base',resourceTarget:'/Lotus/Ore',itemTarget:'/Lotus/Ore',status:'RESOLVED'}]
}],ClientDatafiles:[{uniqueName:'/Lotus/Types/Game/Store/DojoRecipeManifest',values:{RecipeItems:['/Lotus/Deco']}}]}};}
test('dojo cross-file membership is order independent and research links are owner-bound',()=>{
  const f=fixture(),v=new NativeDojo();v.accept({locale:'neutral',sections:{ClientDojoRecipes:f.sections.ClientDojoRecipes}});
  assert.throws(()=>v.verify(),/manifest/);v.accept({locale:'neutral',sections:{ClientDatafiles:f.sections.ClientDatafiles}});v.verify();
  f.sections.ClientDojoRecipes[0].references[0].owner='/Lotus/Child';assert.throws(()=>new NativeDojo().accept(f));
});
test('mismatched roles and omitted research ingredient edges are rejected',()=>{
  let f=fixture();f.sections.ClientDojoRecipes[0].roles.push('ROOMS');assert.throws(()=>new NativeDojo().accept(f));
  f=fixture();f.sections.ClientDojoRecipes[0].references=[];assert.throws(()=>new NativeDojo().accept(f),/Missing dojo/);
});
