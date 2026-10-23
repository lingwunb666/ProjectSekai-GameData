import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {NativeChallengeSelection} from './native-challenge-selection.mjs';

const artifact = 'exports/neutral/ExportClientChallengeSelection.json';
test('selection is optional for old releases but mandatory when declared', () => {
  new NativeChallengeSelection().verify();
  assert.throws(() => new NativeChallengeSelection().verify(true));
  assert.throws(() => new NativeChallengeSelection().accept(artifact, {region:'china', locale:'en'}), /region\/locale/);
});
test('independent real regional artifacts reject modified rules and source claims', {
  skip: !process.env.SEKAI_SELECTION_INTERNATIONAL || !process.env.SEKAI_SELECTION_CHINA
}, () => {
  for (const region of ['international', 'china']) {
    const data = JSON.parse(fs.readFileSync(path.join(process.env['SEKAI_SELECTION_' + region.toUpperCase()], artifact)));
    assert.equal(data.region, region);
    const validate = value => { const verifier = new NativeChallengeSelection(); verifier.accept(artifact, value); verifier.verify(true); };
    validate(data);
    if (region === 'international' && data.sections.ClientChallengeSelection[0].sources.some(
      s => s.reviewedSha256 === '37732628ba33d6965be043e07809e36a8983a21f9e7a897347c9c77269e4827e')) {
      const wrongRegion = structuredClone(data); wrongRegion.region = 'china';
      assert.throws(() => validate(wrongRegion), /reviewed hash/);
    }
    for (const mutate of [row => row.factionPolicy.corpusRemainder = 0,
      row => row.policies.find(p => p.syndicateTag === 'HexSyndicate').titleRequirements.SolNode858 = 5,
      row => row.sources[0].decodedSha256 = '0'.repeat(64), row => row.policies.pop(), row => row.bytecode = 'not public']) {
      const changed = structuredClone(data); mutate(changed.sections.ClientChallengeSelection[0]);
      assert.throws(() => validate(changed));
    }
    const changed = structuredClone(data), row = changed.sections.ClientChallengeSelection[0];
    row.status = 'REVIEW_REQUIRED'; row.rule = null; row.policies = []; row.factionPolicy = null;
    row.sources[0].decodedSha256 = '0'.repeat(64); row.sources[0].verified = false;
    validate(changed); // Facts may be published without authorizing an unknown selection rule.
  }
});
