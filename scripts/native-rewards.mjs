import assert from 'node:assert/strict';

const artifact = 'exports/neutral/ExportClientRewardManifests.json';
const coverageArtifact = 'exports/neutral/ExportClientRewardCoverage.json';
const schema = 'client-mission-reward-manifests-v1';
const modes = ['RS_RARITY', 'RS_CUSTOM_PROBABILITIES', 'RS_CUSTOM_WEIGHTS'];
const hash = value => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'reward hash');
const integer = (value, max) => assert(Number.isSafeInteger(value) && value >= 0 && value <= max, 'reward integer');
const float = value => assert(typeof value === 'number' && Number.isFinite(value) && Math.fround(value) === value, 'reward binary32');
const exact = (value, keys) => {
  assert(value && typeof value === 'object' && !Array.isArray(value));
  assert.deepEqual(Object.keys(value).sort(), [...keys].sort());
};
const identity = value => assert(typeof value === 'string' && value.length <= 1024
  && /^\/(?:[A-Za-z0-9_.'-]+\/)*[A-Za-z0-9_.'-]+$/.test(value)
  && value.split('/').every(x => x !== '.' && x !== '..'), 'reward resource identity');
function source(row, id, provenance) {
  exact(row, ['resource', 'cache', 'tocSha256', 'compressedSha256', 'decodedSha256', 'bytes', 'stamp']);
  assert.equal(row.resource, id); assert.equal(row.cache, 'H.Misc');
  for (const key of ['tocSha256', 'compressedSha256', 'decodedSha256']) hash(row[key]);
  integer(row.bytes, 128 * 1024 * 1024); assert(row.bytes > 0);
  assert(typeof row.stamp === 'string' && /^[1-9][0-9]{0,19}$/.test(row.stamp));
  const actual = provenance.get(id); assert(actual, 'reward acquisition provenance missing');
  for (const key of Object.keys(row)) assert.deepEqual(actual[key], row[key], 'reward acquisition mismatch');
}

/** Validates serialized facts only. A passing release is NOT final drop-probability approval. */
export class NativeRewards {
  accept(path, data) {
    if (![artifact, coverageArtifact].includes(path)) return;
    assert(['international', 'china'].includes(data.region) && data.locale === 'neutral');
    if (this.region) assert.equal(data.region, this.region, 'mixed reward region'); this.region = data.region;
    const field = path === artifact ? 'ClientRewardManifests' : 'ClientRewardCoverage';
    exact(data.sections, [field]);
    if (path === artifact) {assert(!this.records, 'duplicate rewards'); this.records = data.sections[field];}
    else {assert(!this.coverage, 'duplicate reward coverage'); this.coverage = data.sections[field];}
  }
  verify(required = false, manifest = {}) {
    if (!required && !this.records && !this.coverage) return;
    assert.equal(manifest.region, this.region);
    const provenance = new Map();
    let visited = 0;
    function collect(node, depth = 0) {
      assert(depth <= 16 && ++visited <= 128 && node && typeof node === 'object' && !Array.isArray(node), 'provenance tree bounds');
      const records = node.clientExtraction?.sourceRecords ?? [];
      assert(Array.isArray(records) && records.length <= 16384);
      for (const row of records) {
        if (row.cache !== 'H.Misc') continue;
        if (provenance.has(row.resource)) assert.deepEqual(row, provenance.get(row.resource), 'conflicting acquisition');
        provenance.set(row.resource, row); assert(provenance.size <= 16384);
      }
      if (node.inputs !== undefined) {
        assert(Array.isArray(node.inputs) && node.inputs.length <= 16);
        for (const input of node.inputs) collect(input, depth + 1);
      }
    }
    collect(manifest);
    assert(Array.isArray(this.records) && this.records.length <= 4096);
    const ids = new Set(); let stripped = 0, entries = 0;
    for (const row of this.records) {
      exact(row, ['uniqueName', 'format', 'stripped', 'tiers', 'locTag', 'bodySha256', 'exactEnd', 'source']);
      identity(row.uniqueName); assert(!ids.has(row.uniqueName), 'duplicate reward identity'); ids.add(row.uniqueName);
      assert.equal(row.format, schema); assert.equal(row.exactEnd, true); hash(row.bodySha256);
      source(row.source, row.uniqueName, provenance);
      assert(row.source.bytes <= 16 * 1024 * 1024 && row.source.bytes >= 49 && row.source.bytes % 16 === 1);
      assert(typeof row.stripped === 'boolean' && Array.isArray(row.tiers));
      if (row.stripped) {stripped++; assert.equal(row.locTag, null); assert.deepEqual(row.tiers, []); continue;}
      assert.equal(row.tiers.length, 3);
      assert(typeof row.locTag === 'string' && Buffer.byteLength(row.locTag) <= 4096 && !row.locTag.includes('\0'));
      for (const [index, tier] of row.tiers.entries()) {
        exact(tier, ['index', 'selection', 'items', 'bias', 'atten']); assert.equal(tier.index, index);
        assert(modes.includes(tier.selection)); float(tier.bias); float(tier.atten);
        assert(Array.isArray(tier.items) && tier.items.length <= 4096); entries += tier.items.length;
        for (const item of tier.items) {
          exact(item, ['storeItem', 'rarity', 'bias', 'atten', 'probability', 'weight', 'upgradeLevel', 'itemCount', 'dailyCooldown']);
          if (item.storeItem !== '') identity(item.storeItem);
          integer(item.upgradeLevel, 0xffffffff); integer(item.itemCount, 0xffffffff); assert(typeof item.dailyCooldown === 'boolean');
          if (tier.selection === modes[0]) {
            integer(item.rarity, 3); float(item.bias); float(item.atten);
            assert.equal(item.probability, null); assert.equal(item.weight, null);
          } else {
            assert.equal(item.rarity, null); assert.equal(item.bias, null); assert.equal(item.atten, null);
            if (tier.selection === modes[1]) {float(item.probability); assert.equal(item.weight, null);}
            else {float(item.weight); assert.equal(item.probability, null);}
          }
        }
      }
    }
    const c = this.coverage;
    exact(c, ['schema', 'requested', 'decoded', 'stripped', 'entries', 'issues', 'limits']); assert.equal(c.schema, schema);
    integer(c.requested, 4096); assert.equal(c.decoded, this.records.length); assert.equal(c.stripped, stripped);
    assert.equal(c.entries, entries); assert(Array.isArray(c.issues) && c.issues.length <= 4096);
    for (const issue of c.issues) {
      exact(issue, ['resource', 'reason', 'detail', 'source']); identity(issue.resource);
      assert(!ids.has(issue.resource)); ids.add(issue.resource);
      assert.equal(issue.reason, 'UNMODELED_REWARD_MANIFEST'); assert(typeof issue.detail === 'string' && issue.detail.length <= 180);
      source(issue.source, issue.resource, provenance);
    }
    assert.equal(c.requested, ids.size);
    assert(Array.isArray(c.limits) && c.limits.length <= 16 && c.limits.every(s => typeof s === 'string' && s.length <= 1024));
  }
}
