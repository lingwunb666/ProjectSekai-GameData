import assert from 'node:assert/strict';
export const CALLER={"resource":"/Lotus/Interface/CardUtilitiesRedux.lua","bytes":114811,"sha256":"0f35cb09628e86624962119d4d450cb8293556a8aeca62d22d6a9e2114803de4","prototype":62,"parameters":4,"words":625};
export const GETTERS=[{"id":"amar","resource":"/Lotus/Scripts/Mods/MeleeChargeTeleport.lua","sha256":"3f3191013d08259c088093b67c5bfe3a887a984cdbb8cb1240d3b03324fbf521","bytes":4090,"name":"GetLoc","prototype":3,"parameters":1},{"id":"ashen","resource":"/Lotus/Upgrades/Mods/Sets/Ashen/AshenModSetBonusAbility.lua","sha256":"68021d4ef0f78b6bbfb77a3eeacc92eb23bf440d61c72168d2945e06380b64b8","bytes":1724,"name":"GetDescriptionInfo","prototype":0,"parameters":1},{"id":"boneblade","resource":"/Lotus/Upgrades/Mods/Sets/Boneblade/BonebladeModTentacleAbility.lua","sha256":"342d264967812aa43d277a1f8d0de277dd4d0ef86687405e13345e63bde02661","bytes":6220,"name":"GetDescriptionInfo","prototype":0,"parameters":1},{"id":"femur","resource":"/Lotus/Upgrades/Mods/Sets/Femur/FemurModSetBonusAbility.lua","sha256":"306766036d2331f7691e14f54f41b628d76ed4cbfe17da79be10153afe97c8b3","bytes":1898,"name":"GetDescriptionInfo","prototype":0,"parameters":1},{"id":"hawk","resource":"/Lotus/Scripts/Mods/HawkSetPassive.lua","sha256":"9d252bed3f8831dc84dcdaca6b99818ca680335c4fb4a51a1bafe056f2136884","bytes":3360,"name":"GetDescriptionInfo","prototype":0,"parameters":1},{"id":"mecha","resource":"/Lotus/Types/Friendly/Pets/KubrowPetBehaviors/KubrowMarkMechaAbility.lua","sha256":"b3e9305b14bad23e705f4a2144ed3b0815b1778f0e96214473c1e2cc2fcf6217","bytes":6050,"name":"GetDescription","prototype":0,"parameters":1},{"id":"strain","resource":"/Lotus/Types/Friendly/Pets/KubrowPetBehaviors/KubrowChargerStrainAbility.lua","sha256":"dcd4a82cad6371dc0ddd2032bd0379f62b273a4662298befefc2a15195da2c9e","bytes":13031,"name":"GetDescription","prototype":0,"parameters":1},{"id":"synth","resource":"/Lotus/Types/Sentinels/SentinelAbilities/SynthSetMod.lua","sha256":"990b32b4d761ccb867ba4a74ec3dea71fac2b05adebe89c19cef27521cefe0af","bytes":1791,"name":"GetDescription","prototype":0,"parameters":1},{"id":"tek","resource":"/Lotus/Types/Friendly/Pets/CatbrowPetBehaviors/CatbrowTekSetAbility.lua","sha256":"4df3e45ae23fc524dbbf18f52d8295a8230564cc247b0e01a844d5c18cad557d","bytes":6859,"name":"GetDescription","prototype":0,"parameters":1}];
export function verifyModSetDescriptionRules(data,manifest) {
  const rows=data.sections?.ClientModSetDescriptionRules;if(rows===undefined)return;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length<=9,'set description inventory');
  const seen=new Set();
  function source(s,spec) {
    assert(s&&s.resource===spec.resource&&s.bytes===spec.bytes&&s.decodedSha256===spec.sha256&&s.cache==='B.Font'
      &&[s.tocSha256,s.compressedSha256].every(h=>typeof h==='string'&&/^[a-f0-9]{64}$/.test(h))
      &&typeof s.stamp==='string'&&/^[1-9]\d{0,19}$/.test(s.stamp),'set getter source');
    let visited=0,acquired=false;
    function visit(node,depth=0) {
      assert(node&&typeof node==='object'&&!Array.isArray(node)&&depth<=16&&++visited<=128,'set provenance bounds');
      if(node.clientExtraction?.sourceRecords!==undefined) {
        const records=node.clientExtraction.sourceRecords;assert(Array.isArray(records)&&records.length<=16384);
        for(const r of records)if(r.resource===s.resource&&r.cache===s.cache) {
          for(const k of ['resource','cache','bytes','stamp','tocSha256','compressedSha256','decodedSha256'])
            assert.deepEqual(r[k],s[k],'set getter source conflict');
          acquired=true;
        }
      }
      if(node.inputs!==undefined){assert(Array.isArray(node.inputs)&&node.inputs.length<=16);for(const input of node.inputs)visit(input,depth+1);}
    }
    visit(manifest);assert(acquired,'set getter source acquisition missing');
  }
  for(const row of rows) {
    const spec=GETTERS.find(s=>row.uniqueName==='native-mod-set-'+s.id+'-v1');
    assert(spec&&!seen.has(spec.id)&&row.schema==='native-mod-set-description-v1'
      &&row.execution==='NO_SCRIPT_OR_CLIENT_EXECUTION'&&row.scope==='CATALOG_PRESENTATION_NOT_COMBAT','set getter identity');
    seen.add(spec.id);
    source(row.caller?.source,CALLER);source(row.getter?.source,spec);
    assert.deepEqual(row.caller.format,{luau:9,types:3});assert.deepEqual(row.getter.format,{luau:9,types:3});
    assert.deepEqual(row.caller.function,{prototype:62,parameters:4,words:625});
    assert.deepEqual(row.getter.function,{name:spec.name,prototype:spec.prototype,parameters:1,
      symbolHash:({GetLoc:2500553502,GetDescriptionInfo:3662879226,GetDescription:2213775760})[spec.name],
      callerSymbolBinding:'native-luau-script-symbol-v1'});
  }
}

