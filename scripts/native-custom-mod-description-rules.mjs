import assert from 'node:assert/strict';
export const GETTERS=[
  {id:'ammo-mutation',resource:'/Lotus/Scripts/Mods/AmmoMutationMod.lua',bytes:603,
    sha256:'15968ebe9164dc5c1318838b2f3ddfe72f77d62bfd75dea21acc7a53740b6c7e',name:'GetDescriptionInfo',prototype:1,parameters:3,symbolHash:3662879226},
  {id:'resistance-on-damage',resource:'/Lotus/Scripts/Mods/ResistanceOnDamage.lua',bytes:2983,
    sha256:'c9acf46704abe0a3033923ca6573cde76bbf125a2962ce8f6cf2258fb7a5c644',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'lucky-companion',resource:'/Lotus/Types/Sentinels/SentinelAbilities/LuckyCompanion.lua',bytes:1859,
    sha256:'08e608ab7e2e960cff315b482c6800d8baf61df1924ff04e09242407e90d8a9c',name:'GetDescriptionInfo',prototype:1,parameters:2,symbolHash:3662879226},
  {id:'avatar-holster',resource:'/Lotus/Scripts/Mods/AvatarHolsterUpgrades.lua',bytes:2325,
    sha256:'a69e61acfb4df457d8783cbe1b18849e18b5fad64f423cf145203c1c5758739e',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'bleed-fire-rate',resource:'/Lotus/Upgrades/Mods/Rifle/BleedOnImpactFireRateCheck.lua',bytes:3604,
    sha256:'87b75ea62ce0ff90b338026b8d9d0f94a2a48acee7fa5cbeb95795e6272d0883',name:'GetDescription',prototype:5,parameters:1,symbolHash:2213775760},
  {id:'spiders-leap',resource:'/Lotus/Scripts/Mods/SpidersLeap.lua',bytes:646,
    sha256:'66aeeccf9df57c87538834619e860e26e661ebee5bad8cd5ebd027172bbe5dbb',name:'GetDescriptionInfo',prototype:0,parameters:1,symbolHash:3662879226},
  {id:'add-timed-upgrade',resource:'/Lotus/Upgrades/Mods/Warframe/Kahl/AddTimedUpgrade.lua',bytes:1304,
    sha256:'931e5679949feadc4ea12c616bc8201c9fa07c8995bdde0fab4650e93fde5ef4',name:'GetDescriptionInfo',prototype:0,parameters:1,symbolHash:3662879226},
  {id:'proc-ability-stack',resource:'/Lotus/Upgrades/Mods/Warframe/Kahl/ProcAbilityStack.lua',bytes:828,
    sha256:'da20c7a4c03c3f20193b1a4a3dc911ee911815a7bdbe742ca0112f1e3fea8dfc',name:'GetDescriptionInfo',prototype:0,parameters:1,symbolHash:3662879226},
  {id:'spawn-globe',resource:'/Lotus/Upgrades/Mods/Warframe/Kahl/SpawnGlobe.lua',bytes:1672,
    sha256:'b44675a8cdffc0117d56d4643de700a07ab8ad8178cc64e484149f61ea41dbcf',name:'GetDescriptionInfo',prototype:0,parameters:1,symbolHash:3662879226},
  {id:'antique-upgrades',resource:'/Lotus/Upgrades/Mods/Antiques/AntiqueUpgrades.lua',bytes:1833,
    sha256:'a7a00de19307010fb94b4f74d994bdf68d2127b28754ed095cda8b449f06099a',name:'GetDescription',prototype:3,parameters:6,symbolHash:2213775760}
];
export function verifyCustomModDescriptionRules(data,manifest) {
  const rows=data.sections?.ClientCustomModDescriptionRules;if(rows===undefined)return;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length<=GETTERS.length,'custom description inventory');
  const seen=new Set();
  for(const row of rows) {
    const spec=GETTERS.find(s=>row.uniqueName==='native-custom-mod-'+s.id+'-v1');
    assert(spec&&!seen.has(spec.id)&&row.schema==='native-custom-mod-description-v1'
      &&row.execution==='NO_SCRIPT_OR_CLIENT_EXECUTION'&&row.scope==='CATALOG_PRESENTATION_NOT_COMBAT','custom getter identity');
    seen.add(spec.id);
    const s=row.getter?.source;
    assert(s?.resource===spec.resource&&s.bytes===spec.bytes&&s.decodedSha256===spec.sha256&&s.cache==='B.Font'
      &&[s.tocSha256,s.compressedSha256].every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h))
      &&typeof s.stamp==='string'&&/^[1-9]\d{0,19}$/.test(s.stamp),'custom getter source');
    assert.deepEqual(row.getter.format,{luau:9,types:3});
    assert.deepEqual(row.getter.function,{name:spec.name,prototype:spec.prototype,parameters:spec.parameters,
      symbolHash:spec.symbolHash,callerSymbolBinding:'native-luau-script-symbol-v1'});
    let visited=0,acquired=false;
    function visit(node,depth=0) {
      assert(node&&typeof node==='object'&&!Array.isArray(node)&&depth<=16&&++visited<=128,'custom provenance bounds');
      if(node.clientExtraction?.sourceRecords!==undefined) {
        const records=node.clientExtraction.sourceRecords;assert(Array.isArray(records)&&records.length<=16384);
        for(const r of records)if(r.resource===s.resource&&r.cache===s.cache) {
          for(const key of ['cache','resource','bytes','stamp','tocSha256','compressedSha256','decodedSha256'])
            assert.deepEqual(r[key],s[key],'custom source conflict');
          acquired=true;
        }
      }
      if(node.inputs!==undefined){assert(Array.isArray(node.inputs)&&node.inputs.length<=16);for(const input of node.inputs)visit(input,depth+1);}
    }
    visit(manifest);assert(acquired,'custom source acquisition missing');
  }
}
