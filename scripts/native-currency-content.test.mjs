import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyCurrencyContent as verify} from './native-currency-content.mjs';

function fixture() {
  const row={rule:'native-currency-content-v1',uniqueName:'/Lotus/Test',familyRoot:'/EE/Types/Engine/Item',
    resourceChain:['/Lotus/Test','/EE/Types/Engine/Item'],values:{ProductCategory:'CreditBundles',RegularPrice:-50000,
      LocalizeTag:null,PremiumPrice:null,Bonuses:null,GiveCrewShipFusionPoints:null},fieldSources:{}};
  for(const [field,value] of Object.entries(row.values))row.fieldSources[field]=value===null?null:{field,resource:row.uniqueName};
  return {locale:'neutral',sections:{ClientCurrencyBundleContents:[row],ClientCatalogFamilyCoverage:{schema:'client-currency-content-v1',records:1,issues:[]}}};
}
test('public currency verification preserves static null fields',()=>{
  const data=fixture(),copy=structuredClone(data);verify('exports/neutral/currency.json',data);assert.deepEqual(data,copy);
});
test('public currency verification rejects broken chain, field owner and inventory link',()=>{
  for(const mutate of [r=>r.resourceChain.push(r.uniqueName),r=>r.fieldSources.RegularPrice.resource='/Lotus/Outside',r=>delete r.values.PremiumPrice]){
    const data=fixture();mutate(data.sections.ClientCurrencyBundleContents[0]);assert.throws(()=>verify('exports/neutral/currency.json',data));
  }
  const currency=fixture().sections.ClientCurrencyBundleContents[0];
  assert.throws(()=>verify('exports/zh/inventory.json',{sections:{ClientInventoryCreditBundles:[
    {uniqueName:'/Lotus/Store',typeName:'/Lotus/Wrong',currencyContent:currency,values:{TypeName:'/Lotus/Wrong',ProductCategory:'CreditBundles'}}]}}));
});
