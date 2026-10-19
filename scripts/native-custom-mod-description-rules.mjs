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
    sha256:'a7a00de19307010fb94b4f74d994bdf68d2127b28754ed095cda8b449f06099a',name:'GetDescription',prototype:3,parameters:6,symbolHash:2213775760},
  {id:'grimoire-strike',resource:'/Lotus/Upgrades/Grimoire/GrimoireStrike.lua',bytes:428,
    sha256:'b3c9fd49e3ccda8b26e76ba94530c41af55d99fdadc5828d9e86ab06b9735bf4',name:'GetDescription',prototype:0,parameters:3,symbolHash:2213775760},
  {id:'grimoire-range',resource:'/Lotus/Upgrades/Grimoire/RangeUpgradeApplicator.lua',bytes:4439,
    sha256:'bba0f6bf6e975b28641edc256653d19aeb48ea5d99b82d82033cd8545dd41071',name:'GetDescription',prototype:10,parameters:1,symbolHash:2213775760},
  {id:'grimoire-khra',resource:'/Lotus/Upgrades/Grimoire/KhraAuraMod.lua',bytes:1113,
    sha256:'861b7aee26f03fed6495127a5db819a6684b7ab44cb434f3609068f36776c4e2',name:'GetDescription',prototype:3,parameters:1,symbolHash:2213775760},
  {id:'arcane-overshield-crit',resource:'/Lotus/Upgrades/CosmeticEnhancers/Zariman/SecondaryOnOvershieldCritChance.lua',bytes:1231,
    sha256:'1975f6993f1fac68b2a3b27f9c69d7eaa58c3045c43d611c89f21813b178e00b',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'arcane-shield-duration',resource:'/Lotus/Upgrades/CosmeticEnhancers/Zariman/WarframeOnShieldUptimePowerDuration.lua',bytes:1535,
    sha256:'48aea8bf82cd271409989a0de1b095a52ead60cb2af74f7a7a82c26b30fbc8bd',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'arcane-energy-heal',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/HealAlliesOnEnergySpent.lua',bytes:1881,
    sha256:'ecf7f5fcf4e433088058545979dc0f72ea3873d5f772e89b9dd0ed6f66b16a9e',name:'GetDescriptionInfo',prototype:1,parameters:3,symbolHash:3662879226},
  {id:'arcane-ally-buff',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/UpgradePerAllyBuff.lua',bytes:2461,
    sha256:'aa465e54329c967acc9de64601e49e1e2549aa4555a897c20fecabde4b549ada',name:'GetDescription',prototype:1,parameters:1,symbolHash:2213775760},
  {id:'arcane-resistance-stacks',resource:'/Lotus/Upgrades/CosmeticEnhancers/Defensive/DamageResistanceStacksOverTime.lua',bytes:7393,
    sha256:'46670707b0fc0dc3f532f8adf04c9ea5f904cc46fa50e1b7fdf9b2e57fcae05e',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'arcane-free-cast',resource:'/Lotus/Upgrades/Boons/Utility/NoCostCastChanceOnCast.lua',bytes:1315,
    sha256:'44134923bd40b437afeb8cc313d1dfc0ebe0ca7fe76cedd908e97658908c85d7',name:'GetDescriptionFreeCastOnCast',prototype:0,parameters:3,symbolHash:2441447004},
  {id:'arcane-sliding-ammo',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/AmmoEfficiencyOnSliding.lua',bytes:2630,
    sha256:'c4f9cc354c2bc50b94d64778c074396d2056388210cb3de95a97c57c336ffaf2',name:'GetDescription',prototype:1,parameters:1,symbolHash:2213775760},
  {id:'arcane-shield-melee',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/MeleeDamageForActiveShields.lua',bytes:2799,
    sha256:'4c1910d4eb34e59024735fa83131a5ae54de7b04a8b8b8e391bab2810fa03419',name:'GetDescription',prototype:3,parameters:1,symbolHash:2213775760},
  {id:'arcane-combo-bonus',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/MultishotForCombo.lua',bytes:2539,
    sha256:'b23f41119aa66ded6f8dfc8b3dcad550e9bf51371536bdf4153255226cc504c9',name:'GetDescription',prototype:1,parameters:1,symbolHash:2213775760},
  {id:'arcane-residual-buff',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/ResidualTrigger.lua',bytes:17817,
    sha256:'2ad8a7c954171381a372650511b242304bfddeaf52b40476fbcf1491b1bb66a7',name:'GetBuffDescription',prototype:4,parameters:1,symbolHash:738986191},
  {id:'arcane-residual-orb',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/ResidualTrigger.lua',bytes:17817,
    sha256:'2ad8a7c954171381a372650511b242304bfddeaf52b40476fbcf1491b1bb66a7',name:'GetOrbDescription',prototype:3,parameters:1,symbolHash:2122694518},
  {id:'arcane-companion-heal',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/HealCompanion.lua',bytes:1043,
    sha256:'34190b90d24f2feeebc27425ceba472a4acd260959c64dc0444da307674f9869',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'arcane-next-bow-shot',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/BonusDamageForNextShot.lua',bytes:2142,
    sha256:'2fba815185db3e07b21fffcdafc4c2f2ed39e69c19e51f68fde5781f77764460',name:'GetLocValues',prototype:1,parameters:1,symbolHash:2854114375},
  {id:'arcane-secondary-proc',resource:'/Lotus/Upgrades/CosmeticEnhancers/Zariman/SecondaryOnStatusProcBonusDamage.lua',bytes:795,
    sha256:'66d2bee4f451244fe41e15ef8024547a3ff5db7ee911949bff677ed0b80652e7',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760},
  {id:'arcane-operator-next-cast',resource:'/Lotus/Scripts/Mods/StrengthForOneCast.lua',bytes:2826,
    sha256:'d8afe52161d23ac688026edbab7a1e7ab3aec6ccc2123f1a3908d475c1face6e',name:'GetDrainPowerDescription',prototype:1,parameters:1,symbolHash:3368638374},
  {id:'arcane-residual-electric',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/ResidualTrigger.lua',bytes:17817,
    sha256:'2ad8a7c954171381a372650511b242304bfddeaf52b40476fbcf1491b1bb66a7',name:'GetElectricDescription',prototype:0,parameters:1,symbolHash:3484546185},
  {id:'arcane-residual-poison-ice',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/ResidualTrigger.lua',bytes:17817,
    sha256:'2ad8a7c954171381a372650511b242304bfddeaf52b40476fbcf1491b1bb66a7',name:'GetPoisonIceDescription',prototype:1,parameters:1,symbolHash:1525704190},
  {id:'arcane-residual-cyst',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/ResidualTrigger.lua',bytes:17817,
    sha256:'2ad8a7c954171381a372650511b242304bfddeaf52b40476fbcf1491b1bb66a7',name:'GetCystDescription',prototype:2,parameters:1,symbolHash:1178643597},
  {id:'arcane-radial-cooldown',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/RadialHeal.lua',bytes:1399,
    sha256:'79c53ed73cc003ee9657aa597b45c3b0412376d184e6068c75ee1f9c54ea990e',name:'GetCooldown',prototype:0,parameters:1,symbolHash:351567011},
  {id:'arcane-radial-amount',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/RadialHeal.lua',bytes:1399,
    sha256:'79c53ed73cc003ee9657aa597b45c3b0412376d184e6068c75ee1f9c54ea990e',name:'GetHealAmount',prototype:1,parameters:1,symbolHash:1210800564},
  {id:'arcane-radial-radius',resource:'/Lotus/Upgrades/CosmeticEnhancers/Utility/RadialHeal.lua',bytes:1399,
    sha256:'79c53ed73cc003ee9657aa597b45c3b0412376d184e6068c75ee1f9c54ea990e',name:'GetHealRadius',prototype:2,parameters:1,symbolHash:2186791746},
  {id:'arcane-slam-pull',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/MeleeArcanePull.lua',bytes:1146,
    sha256:'a7e255f88c4eace68c8d880818e463a939fb13151e6b7ca624601482c4c3fe3d',name:'GetDescriptionInfo',prototype:0,parameters:1,symbolHash:3662879226},
  {id:'arcane-give-stat',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/GiveStatForStat.lua',bytes:4863,
    sha256:'79254f689a3fbb4bf5deb2fd277647f86b333acf57189efedc996b474580e71a',name:'GetDescriptionInfo',prototype:0,parameters:2,symbolHash:3662879226},
  {id:'arcane-give-stat-damage',resource:'/Lotus/Upgrades/CosmeticEnhancers/Offensive/GiveStatForDamageType.lua',bytes:5814,
    sha256:'6478224a7fd381c2ef39d69eca8893e5bdb508558e2257bea5be249c15e8f1e7',name:'GetDescriptionInfo',prototype:0,parameters:2,symbolHash:3662879226},
  {id:'arcane-per-armor',resource:'/Lotus/Upgrades/Boons/Offensive/StatIncreasePerArmor.lua',bytes:3822,
    sha256:'0bc2be08dd01ea453464ca88a9e8ddef26b8a4242005ffe9c776dca86715176c',name:'GetDescription',prototype:0,parameters:1,symbolHash:2213775760}
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
