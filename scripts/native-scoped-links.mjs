import assert from 'node:assert/strict';

const fields={
  ClientSyndicates:['Manifest','JobManifest','SeasonCurrency','SeasonVendorManifest',
    'SeasonFeaturedRewards/*/ItemType','SeasonFeaturedStoreItemRewards/*',
    'SeasonChallenges/*/dailyChallenges/*','SeasonChallenges/*/weeklyChallenges/*',
    'Titles/*/rewards/*/ItemType','Titles/*/sacrifice/items/*/ItemType'],
  ClientRelics:['RewardManifest'],ClientAnimals:['HuntingInfo/ItemReward','HuntingInfo/WoundedAnimalReward'],
  ClientFocusUpgrades:['ParentAbility'],ClientFocusAbilities:['ParentAbility','BaseTree'],
  ClientPlayerPowerSuits:['AbilityTypes/*','DefaultSlottedUpgrades/*/ItemType'],
  ClientCompanionPowerSuits:['DefaultWeapon','AbilityTypes/*','DefaultSlottedUpgrades/*/ItemType','AdditionalItems/*','SpecialSlotItem/*/ItemType'],
  ClientPetPowerSuits:['DefaultWeapon','AbilityTypes/*','DefaultSlottedUpgrades/*/ItemType','AdditionalItems/*','SpecialSlotItem/*/ItemType'],
  ClientEmailItems:['Message/att/*'],
  ClientInventoryDetailStores:['AdditionalItems/*/TypeName','RandomizedUpgrades/*','CrewShipUpgrades/*','DefaultSlottedUpgrades/*/ItemType'],
  ClientInventoryDetailItems:['AdditionalItems/*','RandomizedUpgrades/*','CrewShipUpgrades/*','DefaultSlottedUpgrades/*/ItemType'],
  ClientBundles:['PackageComponents/*/TypeName'],
  ClientBoosterPacks:['Components/*/Item','COMMON_Components/*/Item','UNCOMMON_Components/*/Item',
    'RARE_Components/*/Item','LEGENDARY_Components/*/Item'],
  ClientTilesetManifests:['Tilesets/*'],ClientTilesets:['MissionPermutations/*/procLevel',
    'MissionPermutations/*/enemySpecs/*','MissionPermutations/*/extraEnemySpecs/*',
    'MissionPermutations/*/vipAgent','MissionPermutations/*/advancedSpawners/*'],
  ClientAchievementRegistries:['EnabledChallenges/*'],ClientChallengeDefinitions:['Parents/*'],
  ClientLoreFragments:['PowerSuitRes','Song','SecretTransmission'],
  ClientNpcResources:['AvatarTypes/*','NewAdditionalInventory/*/item','DamageControllerType','DropTable','AbilityResistanceData','HitProxies/*/Type']};
const resource=x=>typeof x==='string'&&/^\/(?:[A-Za-z0-9_.-]+\/)*[A-Za-z0-9_.-]+$/.test(x)
  &&x.split('/').every(p=>p!=='.'&&p!=='..');
const escape=x=>x.replaceAll('~','~0').replaceAll('/','~1');
export function verifyScopedLinks(sections) {
  for(const [section,rows]of Object.entries(sections??{})) {
    if(section==='ClientInventoryDetails') {
      assert(Array.isArray(rows)&&rows.length<=12000);
      for(const row of rows) {
        assert.equal(row.rule,'native-inventory-details-v1');
        assert.equal(row.store?.uniqueName,row.uniqueName);assert.equal(row.item?.uniqueName,row.itemTarget);
        assert(resource(row.uniqueName)&&resource(row.itemTarget));
        for(const layer of [row.store,row.item])assert.equal(layer.referenceRule,'native-declaration-scope-v2');
        verifyScopedLinks({ClientInventoryDetailStores:[row.store],ClientInventoryDetailItems:[row.item]});
      }
      continue;
    }
    if(!fields[section])continue;
    assert(Array.isArray(rows));
    for(const row of rows) {
      if(row.referenceRule!=='native-declaration-scope-v2')continue; // Earlier inventories have a smaller v1 contract.
      assert(Array.isArray(row.references));const expected=new Map();
      function collect(value,segments,pointer,owner) {
        if(value===null||value===undefined||value==='')return;
        if(!segments.length) {assert(typeof value==='string');expected.set(pointer,{raw:value,owner});return;}
        const [head,...tail]=segments;
        if(head==='*') {
          assert(typeof value==='object','Native link container');
          for(const [key,child]of Object.entries(value))collect(child,tail,pointer+'/'+escape(key),owner);
        } else collect(value[head],tail,pointer+'/'+head,owner??row.fieldSources?.[head]?.resource);
      }
      for(const pattern of fields[section])collect(row.values,pattern.split('/'),'/values',section==='ClientNpcResources'?row.uniqueName:null);
      for(const ref of row.references) {
        const e=expected.get(ref.pointer);assert(e,'Unknown/duplicate native link');
        assert.equal(ref.rawTarget,e.raw);assert.equal(ref.owner,e.owner);assert(resource(ref.owner),'Native link owner');
        if(ref.status==='RESOLVED')assert(resource(ref.resourceTarget));
        else {assert.equal(ref.status,'UNRESOLVED');assert.equal(ref.resourceTarget,null);}
        expected.delete(ref.pointer);
      }
      assert.equal(expected.size,0,'Missing declaration-scoped links');
    }
  }
}
