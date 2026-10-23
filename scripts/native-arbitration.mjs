import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

const artifact = 'exports/neutral/ExportClientArbitrationSelection.json';
const capability = 'client-arbitration-selection-facts-v1';
const sorted = x => Array.isArray(x) ? x.map(sorted) : x && typeof x === 'object'
  ? Object.fromEntries(Object.keys(x).sort().map(k => [k, sorted(x[k])])) : x;
const common = {
  '/Lotus/Interface/Background.lua': 'c6bdb693d659aba73f8347df859f9457f560aa7b38d1f662f26d30357e612e13',
  '/EE/Interface/Utilities.lua': 'df58ebe84b5bf51bf0adfd2b171b4b36d551195cbd7db92aa1087a9a39ea7ad5',
  '/Lotus/Scripts/Libs/MissionsLib.lua': '1c53e60dea701fe891923839723ce1be7f37e862bab72afc2e59132e86debb7c'
};
export class NativeArbitration {
  accept(path, data) {
    if (path !== artifact) return;
    assert(!this.data, 'duplicate arbitration artifact'); this.data = data;
  }
  verify(manifest) {
    assert(!manifest.capabilities?.includes(capability) || this.data, 'arbitration artifact missing');
    if (!this.data) return;
    const region = manifest.region; assert(['china', 'international'].includes(region));
    assert.equal(this.data.region, region); assert.equal(this.data.locale, 'neutral');
    const rows = this.data.sections?.ClientArbitrationSelection;
    assert(Array.isArray(rows) && rows.length === 1); const row = rows[0];
    assert.equal(row.schemaVersion, 1); assert.equal(row.uniqueName, 'hourly-arbitration-selection');
    const reviewed = row.status === 'REVIEWED_SCRIPT_SELECTION';
    if (reviewed) {
      assert.equal(row.rule, 'native-hourly-arbitration-v1');
      assert.equal(createHash('sha256').update(JSON.stringify(sorted(row.policy)) + '\n').digest('hex'),
        '16ee33d37b1575d0b8155c799c86d4881bea728a744706e10aafbbc7ea66c80a', 'arbitration policy');
    } else {assert.equal(row.status, 'REVIEW_REQUIRED'); assert.equal(row.rule, null); assert.equal(row.policy, null);}
    const expected = {...common, '/Lotus/Interface/LotusUtilities.lua': region === 'china'
      ? '1970d4367a18ed9938e03754e72e6c5fabb706bb82aff401622c0a910d86a30b'
      : '03c1dd3ae803896b7853d1976450f6ec22c3878497176b2bc8e49facec95249a'};
    const sources = new Map(); let visited = 0;
    function collect(node, depth = 0) {
      assert(node && typeof node === 'object' && !Array.isArray(node) && depth <= 16 && ++visited <= 128);
      const records = node.clientExtraction?.sourceRecords ?? []; assert(Array.isArray(records) && records.length <= 16384);
      for (const source of records) if (source.cache === 'B.Font') {
        if (sources.has(source.resource)) assert.equal(sources.get(source.resource), source.decodedSha256, 'conflicting source');
        sources.set(source.resource, source.decodedSha256); assert(sources.size <= 16384);
      }
      const inputs = node.inputs ?? []; assert(Array.isArray(inputs) && inputs.length <= 16);
      for (const input of inputs) collect(input, depth + 1);
    }
    collect(manifest);
    assert(Array.isArray(row.sources) && row.sources.length === 4); const seen = new Set();
    for (const source of row.sources) {
      assert(Object.hasOwn(expected, source.resource) && !seen.has(source.resource)); seen.add(source.resource);
      const alternate=region==='china'&&source.resource==='/Lotus/Interface/LotusUtilities.lua'
        &&source.reviewedSha256==='5736580711930c267047875897a60ca4520624ed5ae856b887087cf4904bbeed';
      const currentInternational=region==='international'&&(
        source.resource==='/Lotus/Interface/LotusUtilities.lua'
          &&source.reviewedSha256==='dcfed1dd50907c848846f976075cbd916d7fb12e647f1f4f9cf150e88e66ddaf'
        ||source.resource==='/Lotus/Interface/Background.lua'
          &&source.reviewedSha256==='37732628ba33d6965be043e07809e36a8983a21f9e7a897347c9c77269e4827e');
      assert(source.reviewedSha256===expected[source.resource]||alternate||currentInternational,'regional reviewed hash');
      assert.equal(source.verified, source.decodedSha256 === source.reviewedSha256);
      assert(!reviewed || source.verified);
      if (source.decodedSha256 !== null) {
        assert(typeof source.decodedSha256 === 'string' && /^[a-f0-9]{64}$/.test(source.decodedSha256));
        assert.equal(sources.get(source.resource), source.decodedSha256, 'arbitration acquisition missing/mismatched');
      }
    }
  }
}
