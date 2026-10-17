import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {NativeRewards} from './native-rewards.mjs';

function verify(input, mutate = () => {}, mutateManifest = () => {}) {
  const data = structuredClone(input); mutate(data);
  const validator = new NativeRewards();
  validator.accept('exports/neutral/ExportClientRewardManifests.json', {region: data.region, locale: 'neutral',
    sections: {ClientRewardManifests: data.records}});
  validator.accept('exports/neutral/ExportClientRewardCoverage.json', {region: data.region, locale: 'neutral',
    sections: {ClientRewardCoverage: data.coverage}});
  const manifest = {region: data.region, clientExtraction: {sourceRecords: input.records.map(r => r.source)}};
  mutateManifest(manifest); validator.verify(true, manifest);
}
test('missing declared reward inputs cannot pass', () => {
  new NativeRewards().verify(false);
  assert.throws(() => new NativeRewards().verify(true, {region: 'china'}));
});
test('real independent regional facts and precise negative cases', {skip: !process.env.SEKAI_REWARD_FIXTURE_ROOT}, () => {
  for (const region of ['china', 'international']) {
    const data = JSON.parse(fs.readFileSync(path.join(process.env.SEKAI_REWARD_FIXTURE_ROOT, region+'-rewards-all-1/rewards.json')));
    verify(data);
    verify(data, () => {}, m => {m.inputs = [{inputs: [{clientExtraction: m.clientExtraction}]}]; delete m.clientExtraction;});
    assert.throws(() => verify(data, () => {}, m => {const copy = structuredClone(m.clientExtraction);
      copy.sourceRecords[0].tocSha256 = '0'.repeat(64); m.inputs = [{clientExtraction: copy}];}));
    for (const mutate of [
      d => d.records.push(d.records[0]),
      d => d.coverage.entries++,
      d => d.records[0].source.tocSha256 = '0'.repeat(64),
      d => d.records[0].exactEnd = false,
      d => d.records.find(r => r.stripped).stripped = false,
      d => d.records.find(r => !r.stripped).tiers[0].index = 1,
      d => d.records.find(r => r.tiers.some(t => t.items.length)).tiers.find(t => t.items.length).items[0].itemCount = -1,
      d => d.records.find(r => r.tiers.some(t => t.items.length)).tiers.find(t => t.items.length).items[0].dailyCooldown = 0,
      d => d.records[0].extraRawBytes = 'not a public field'
    ]) assert.throws(() => verify(data, mutate));
  }
});
