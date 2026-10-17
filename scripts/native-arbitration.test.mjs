import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {NativeArbitration} from './native-arbitration.mjs';

test('arbitration capability requires its artifact', () => {
  assert.throws(() => new NativeArbitration().verify({capabilities: ['client-arbitration-selection-facts-v1']}));
  new NativeArbitration().verify({});
});
test('actual regional release provenance and full policy fingerprint', {skip: !process.env.SEKAI_ARBITRATION_RELEASE_RUNS}, () => {
  const root = process.env.SEKAI_ARBITRATION_RELEASE_RUNS; const seen = new Set();
  for (const item of fs.readdirSync(root, {withFileTypes: true}).filter(x => x.isDirectory())) {
    const run = JSON.parse(fs.readFileSync(path.join(root, item.name, 'run.json')));
    const manifest = JSON.parse(fs.readFileSync(path.join(run.releaseDirectory, 'manifest.json')));
    const artifact = 'exports/neutral/ExportClientArbitrationSelection.json';
    const data = JSON.parse(fs.readFileSync(path.join(run.releaseDirectory, artifact)));
    const v = new NativeArbitration(); v.accept(artifact, data); v.verify(manifest); seen.add(run.region);
    assert.throws(() => v.verify({region: run.region}));
    const row = data.sections.ClientArbitrationSelection[0]; row.policy.specialHourModulus = 36;
    assert.throws(() => v.verify(manifest));
    row.status = 'REVIEW_REQUIRED'; row.rule = null; row.policy = null; v.verify(manifest);
    data.region = run.region === 'china' ? 'international' : 'china'; assert.throws(() => v.verify(manifest));
  }
  assert.deepEqual([...seen].sort(), ['china', 'international']);
});
