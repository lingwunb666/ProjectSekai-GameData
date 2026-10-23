import assert from 'node:assert/strict';

const hashes = new Map([
  ['/Lotus/Interface/Libs/SyndicateMissionGenerator.lua', '4244c85ab86d8305855cabdff79efe25abc9d56d03895c5c8be651e895df6b6a'],
  ['/EE/Interface/Utilities.lua', 'df58ebe84b5bf51bf0adfd2b171b4b36d551195cbd7db92aa1087a9a39ea7ad5'],
  ['/Lotus/Interface/Background.lua', 'c6bdb693d659aba73f8347df859f9457f560aa7b38d1f662f26d30357e612e13']
]);
const hexPrefix = '/Lotus/Types/Gameplay/1999Wf/ProtoframeAllies/';
const exact = (object, keys) => {
  assert(object && typeof object === 'object' && !Array.isArray(object));
  assert.deepEqual(Object.keys(object).sort(), [...keys].sort());
};
export class NativeChallengeSelection {
  accept(path, data) {
    if (path !== 'exports/neutral/ExportClientChallengeSelection.json') return;
    assert(!this.data, 'duplicate selection declaration');
    assert(['china', 'international'].includes(data.region) && data.locale === 'neutral', 'selection region/locale');
    this.region = data.region;
    exact(data.sections, ['ClientChallengeSelection']);
    assert(Array.isArray(data.sections.ClientChallengeSelection) && data.sections.ClientChallengeSelection.length === 1);
    this.data = data.sections.ClientChallengeSelection[0];
  }
  verify(required = false) {
    if (!required && !this.data) return;
    const d = this.data;
    exact(d, ['uniqueName', 'schemaVersion', 'rule', 'status', 'sources', 'policies', 'factionPolicy', 'limits']);
    assert.equal(d.uniqueName, 'syndicate-script-selection'); assert.equal(d.schemaVersion, 1);
    assert(Array.isArray(d.sources) && d.sources.length === 3, 'selection source coverage');
    const seen = new Set();
    for (const source of d.sources) {
      exact(source, ['resource', 'decodedSha256', 'reviewedSha256', 'verified']);
      assert(hashes.has(source.resource) && !seen.has(source.resource), 'selection source identity'); seen.add(source.resource);
      const currentInternational = this.region === 'international'
        && source.resource === '/Lotus/Interface/Background.lua'
        && source.reviewedSha256 === '37732628ba33d6965be043e07809e36a8983a21f9e7a897347c9c77269e4827e';
      assert(source.reviewedSha256 === hashes.get(source.resource) || currentInternational, 'selection reviewed hash');
      assert(source.decodedSha256 === null || /^[a-f0-9]{64}$/.test(source.decodedSha256));
      assert.equal(source.verified, source.decodedSha256 === source.reviewedSha256, 'selection source verification');
    }
    assert(Array.isArray(d.limits) && d.limits.length <= 16 && d.limits.every(x => typeof x === 'string' && x.length <= 1024));
    if (d.status === 'REVIEW_REQUIRED') {
      assert.equal(d.rule, null); assert.deepEqual(d.policies, []); assert.equal(d.factionPolicy, null); return;
    }
    assert.equal(d.status, 'REVIEWED_SCRIPT_SELECTION'); assert.equal(d.rule, 'syndicate-script-selection-v1');
    assert(d.sources.every(x => x.verified), 'unreviewed selection source');
    assert.deepEqual(d.factionPolicy, {rule: 'zariman-background-seed-v1', syndicateTag: 'ZarimanSyndicate',
      regionName: '/Lotus/Language/Zariman/ZarimanRegionName', missionTypes: [34, 1, 2, 8, 9, 35, 36],
      seedConversion: 'BINARY32_THEN_MODULO', modulus: 2, corpusRemainder: 1, corpusFaction: 1,
      overrideOrder: 'FIRST_ACTIVE_OFFICIAL_THEN_LOCAL_APPEND_OTHERWISE_NATIVE_BASE'});
    assert(Array.isArray(d.policies) && d.policies.length === 3);
    const tags = new Set();
    for (const p of d.policies) {
      exact(p, ['syndicateTag', 'removableNodes', 'extraTierNodes', 'excludedAgents', 'titleRequirements']);
      assert(['ZarimanSyndicate', 'EntratiLabSyndicate', 'HexSyndicate'].includes(p.syndicateTag) && !tags.has(p.syndicateTag));
      tags.add(p.syndicateTag);
      const hex = p.syndicateTag === 'HexSyndicate';
      assert.deepEqual(p.removableNodes, hex ? ['SolNode851', 'SolNode852', 'SolNode853', 'SolNode854'] : []);
      assert.deepEqual(p.extraTierNodes, hex ? ['SolNode852', 'SolNode850', 'SolNode854'] : []);
      assert.deepEqual(p.titleRequirements, hex ? {SolNode858: 4} : {});
      assert.deepEqual(p.excludedAgents, hex ? Object.fromEntries([[856, 'Arthur'], [852, 'Lettie'], [851, 'Amir'],
        [850, 'Eleanor'], [853, 'Aoi'], [854, 'Quincy']].map(([node, agent]) => [`SolNode${node}`, `${hexPrefix}${agent}AllyAgent`])) : {});
    }
  }
}
