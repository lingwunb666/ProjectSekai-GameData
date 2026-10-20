import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {NativeArbitration} from './native-arbitration.mjs';

test('new China source revision remains region-bound with exact acquisition and policy',()=>{
  const sources=[
    ['/Lotus/Interface/Background.lua','c6bdb693d659aba73f8347df859f9457f560aa7b38d1f662f26d30357e612e13'],
    ['/EE/Interface/Utilities.lua','df58ebe84b5bf51bf0adfd2b171b4b36d551195cbd7db92aa1087a9a39ea7ad5'],
    ['/Lotus/Scripts/Libs/MissionsLib.lua','1c53e60dea701fe891923839723ce1be7f37e862bab72afc2e59132e86debb7c'],
    ['/Lotus/Interface/LotusUtilities.lua','5736580711930c267047875897a60ca4520624ed5ae856b887087cf4904bbeed']
  ].map(([resource,hash])=>({resource,decodedSha256:hash,reviewedSha256:hash,verified:true}));
  const row={schemaVersion:1,uniqueName:'hourly-arbitration-selection',status:'REVIEWED_SCRIPT_SELECTION',
    rule:'native-hourly-arbitration-v1',sources,policy:{intervalSeconds:3600,seedEpochSeconds:1074038400,
      hourCounterEpochSeconds:1391990400,specialHourModulus:37,specialHourRemainder:0,
      excludedRegions:[19,14,20,21,22,23,24,25],missionTypes:[2,8,13,21,17,27,33],nodeTypes:[0,4],
      excludedLevelSubstring:'EntratiLab/',specialNodes:['SolNode718','SolNode232','SolNode233','SolNode230','SolNode719','SolNode309'],
      selection:'SHUFFLE_REGIONS_TAKE_FIRST_THEN_SHUFFLE_ELIGIBLE_NODES_TAKE_FIRST',
      rng:'NATIVE_LCG64_LOW30_OF_HIGH32_MODULO_FISHER_YATES',emptyRegion:'UNAVAILABLE_NO_REROLL'}};
  const data={region:'china',locale:'neutral',sections:{ClientArbitrationSelection:[row]}};
  const manifest={region:'china',clientExtraction:{sourceRecords:sources.map(s=>({cache:'B.Font',resource:s.resource,decodedSha256:s.decodedSha256}))}};
  const v=new NativeArbitration();v.accept('exports/neutral/ExportClientArbitrationSelection.json',data);v.verify(manifest);
  assert.throws(()=>v.verify({region:'china'}));
  manifest.region='international';data.region='international';assert.throws(()=>v.verify(manifest));
  manifest.region='china';data.region='china';
  sources[3].reviewedSha256='a'.repeat(64);assert.throws(()=>v.verify(manifest));
});
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
