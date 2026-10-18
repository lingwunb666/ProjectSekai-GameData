import assert from 'node:assert/strict';

const fields=['ProductCategory','LocalizeTag','RegularPrice','PremiumPrice','Bonuses','GiveCrewShipFusionPoints'];
const resource=id=>typeof id==='string'&&/^\/(Lotus|EE)\//.test(id)&&!id.includes('..')&&!id.includes('\\');
export function verifyCurrencyContent(path,data) {
  if(!path.startsWith('exports/'))return;
  for(const [section,rows] of Object.entries(data.sections??{})) {
    const neutral=section==='ClientCurrencyBundleContents';
    if(!neutral&&!['ClientInventoryCreditBundles','ClientInventoryFusionBundles'].includes(section))continue;
    assert(Array.isArray(rows)&&rows.length<=4096,'currency count');
    const seen=new Set();
    for(const row of rows) {
      const content=neutral?row:row.currencyContent;
      if(!neutral&&content==null)continue;
      const id=content.uniqueName,key=neutral?id:row.uniqueName;
      assert(resource(id)&&id.startsWith('/Lotus/')&&!seen.has(key),'currency identity');seen.add(key);
      assert.equal(content.rule,'native-currency-content-v1');
      const chain=content.resourceChain;
      assert(Array.isArray(chain)&&chain.length>0&&chain.length<=100&&chain.every(resource),'currency ancestry');
      assert.equal(chain[0],id);assert.equal(new Set(chain).size,chain.length);
      assert(chain.includes(content.familyRoot));
      const category=content.values?.ProductCategory;
      assert(category==='FusionBundles'&&content.familyRoot==='/Lotus/Types/Items/FusionBundle'
        ||category==='CreditBundles'&&['/EE/Types/Engine/Item','/Lotus/Types/Game/LotusPickUpItem'].includes(content.familyRoot),'currency family');
      assert(content.familyRoot!=='/EE/Types/Engine/Item'||!chain.includes('/Lotus/Types/Game/LotusPickUpItem'),'pickup classification');
      for(const field of fields) {
        assert(Object.hasOwn(content.values,field),'currency missing field');
        const value=content.values[field],owner=content.fieldSources?.[field];
        if(value===null)assert.equal(owner,null,'currency absent owner');
        else assert(owner?.field===field&&chain.includes(owner.resource),'currency owner outside target chain');
      }
      assert(content.values.Bonuses===null||Array.isArray(content.values.Bonuses)&&content.values.Bonuses.length<=128);
      assert([null,0,1].includes(content.values.GiveCrewShipFusionPoints));
      if(!neutral) {
        assert.equal(row.typeName,id);assert.equal(row.values?.TypeName,id);
        assert.equal(row.values.ProductCategory,category);
      }
    }
    if(neutral) {
      const coverage=data.sections.ClientCatalogFamilyCoverage;
      assert.equal(data.locale,'neutral');assert(rows.length>0);
      assert.equal(coverage?.schema,'client-currency-content-v1');assert.equal(coverage.records,rows.length);
      assert(Array.isArray(coverage.issues)&&coverage.issues.length===0,'currency coverage');
    }
  }
}
