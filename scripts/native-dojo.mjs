import assert from 'node:assert/strict';

const MANIFEST='/Lotus/Types/Game/Store/DojoRecipeManifest';
const roots=new Map([['DojoRecipeItem','ROOMS'],['DojoDecorationRecipeItem','DECOS'],
  ['DojoColorRecipeItem','COLOURS'],['DojoSkyboxRecipeItem','BACKDROPS'],['RecipeItem',null]]
  .map(([root,role])=>['/Lotus/Types/Game/'+root,role]));
export class NativeDojo {
  #members=new Set();
  #recipes=new Map();
  accept(data) {
    for(const row of data.sections?.ClientDatafiles??[])if(row.uniqueName===MANIFEST) {
      assert.equal(data.locale,'neutral');assert(Array.isArray(row.values?.RecipeItems));
      for(const id of row.values.RecipeItems)this.#members.add(id);
    }
    for(const row of data.sections?.ClientDojoRecipes??[]) {
      assert.equal(data.locale,'neutral');assert.equal(row.selectionRule,'dojo-manifest-class-v1');
      assert.equal(row.manifest,MANIFEST);assert(roots.has(row.familyRoot),'Unknown dojo class');
      assert(typeof row.uniqueName==='string'&&!this.#recipes.has(row.uniqueName),'Duplicate dojo recipe');
      const expected=[];
      if(roots.get(row.familyRoot))expected.push(roots.get(row.familyRoot));
      if(row.values?.IsResearch===1)expected.push('RESEARCH');
      if(row.values?.IsPersonalGuildHybridResearch===1)expected.push('FABRICATIONS');
      assert(expected.length);assert.deepEqual([...row.roles].sort(),expected.sort(),'Dojo role/flag mismatch');
      assert.equal(row.referenceRule,'native-declaration-scope-v1');
      assert(Array.isArray(row.references));
      const pointers=new Map();
      if(typeof row.values?.ResultItem==='string'&&row.values.ResultItem)
        pointers.set('/values/ResultItem',{field:'ResultItem',raw:row.values.ResultItem});
      for(const field of ['Ingredients','SecretIngredients','ResearchIngredients']) {
        const values=row.values?.[field];if(values==null)continue;
        assert(Array.isArray(values)&&values.length<=4096);
        values.forEach((v,i)=>{
          if(typeof v?.ItemType==='string'&&v.ItemType)pointers.set(`/values/${field}/${i}/ItemType`,{field,raw:v.ItemType});
          else assert(row.referenceIssues?.some(issue=>issue.resource===row.uniqueName
            &&issue.pointer===`/values/${field}/${i}`&&issue.reason==='MISSING_RECIPE_INGREDIENT_TYPE'));
        });
      }
      for(const ref of row.references) {
        const expected=pointers.get(ref.pointer);assert(expected,'Unknown/duplicate dojo reference');
        assert.equal(ref.rawTarget,expected.raw);assert.equal(ref.owner,row.fieldSources?.[expected.field]);
        assert(typeof ref.owner==='string'&&ref.owner.startsWith('/'),'Missing dojo declaration owner');
        if(ref.status==='RESOLVED')for(const field of ['resourceTarget','itemTarget'])
          assert(typeof ref[field]==='string'&&ref[field].startsWith('/'),'Invalid dojo reference target');
        else {assert.equal(ref.status,'UNRESOLVED');assert.equal(ref.resourceTarget,null);assert.equal(ref.itemTarget,null);}
        pointers.delete(ref.pointer);
      }
      assert.equal(pointers.size,0,'Missing dojo references');
      this.#recipes.set(row.uniqueName,row.roles);
    }
  }
  verify() {
    for(const id of this.#recipes.keys())assert(this.#members.has(id),'Dojo recipe outside same-release manifest');
  }
}
