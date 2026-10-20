import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyRecipeQuantityAncestry} from './native-recipe-quantity.mjs';
const row=()=>({uniqueName:'/Lotus/Recipe',values:{NumToGive:null},fieldSources:{NumToGive:null},
  quantityAncestry:{schema:'recipe-quantity-ancestry-v1',resourceChain:['/Lotus/Recipe','/Lotus/Types/Game/RecipeItem'],
    nativeRoot:'/Lotus/Types/Game/RecipeItem',opaqueLayers:[]}});
test('old and complete/opaque new rows keep nulls and do not gain default counts',()=>{
  const value=row(),before=structuredClone(value);verifyRecipeQuantityAncestry({ClientRecipes:[value]});
  assert.deepEqual(value,before);value.quantityAncestry.opaqueLayers.push('/Lotus/Recipe');
  verifyRecipeQuantityAncestry({ClientDojoRecipes:[value]});delete value.quantityAncestry;
  verifyRecipeQuantityAncestry({ClientRecipes:[value]});assert.equal(value.values.NumToGive,null);
});
test('malformed, extra, duplicate and misbound source facts are rejected',()=>{
  for(const alter of [x=>x.quantityAncestry=null,x=>x.quantityAncestry.schema='other',
    x=>x.quantityAncestry.resourceChain.push('/Lotus/Recipe'),x=>x.quantityAncestry.resourceChain[0]='/Lotus/Other',
    x=>x.quantityAncestry.nativeRoot='/Lotus/Other',x=>x.quantityAncestry.resourceChain[0]='/Lotus/../Recipe',
    x=>x.quantityAncestry.opaqueLayers.push('/Lotus/Other'),x=>x.familyRoot='/Lotus/Other',
    x=>x.quantityAncestry.defaultValue=1]) {
    const value=row();alter(value);assert.throws(()=>verifyRecipeQuantityAncestry({ClientRecipes:[value]}));
  }
});
