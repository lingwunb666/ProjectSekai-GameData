import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, lstat} from 'node:fs/promises';
import {resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const regions = new Set(['international', 'china']);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const sorted = value => Array.isArray(value) ? value.map(sorted) : value && typeof value === 'object'
  ? Object.fromEntries(Object.keys(value).sort().map(key => [key, sorted(value[key])])) : value;
async function read(path) {
  const stat = await lstat(path); assert(stat.isFile() && !stat.isSymbolicLink() && stat.size <= 48 * 1024 * 1024, 'Unsafe/oversized file');
  return readFile(path);
}
async function json(path) { return JSON.parse(await read(path)); }
async function walk(path) {
  const files = [];
  for (const entry of await readdir(path, {withFileTypes: true})) {
    assert(!entry.isSymbolicLink(), 'Symlinks are not public data');
    const target = resolve(path, entry.name);
    if (entry.isDirectory()) files.push(...await walk(target)); else { assert(entry.isFile()); files.push(target); }
  }
  return files;
}
function publicData(value) {
  if (Array.isArray(value)) value.forEach(publicData);
  else if (value && typeof value === 'object') for (const [key, item] of Object.entries(value)) {
    assert(!new Set(['password','passwd','appsecret','apikey','accesstoken','clientsecret','authorization','cookie','privatekey'])
      .has(key.toLowerCase().replace(/[_-]/g, '')), 'Credential field');
    publicData(item);
  } else if (typeof value === 'string') {
    assert(!/PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|[A-Za-z]:[\\/](?:Users|dev|ProjectSekaiAcceptance)[\\/]|(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\//.test(value), 'Private content');
  }
}
let releases = 0;
for (const region of regions) {
  const regionRoot = resolve(root, 'datasets', region);
  let entries;
  try { entries = await readdir(regionRoot, {withFileTypes:true}); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  for (const entry of entries) assert(['releases', 'latest.json', 'status.json'].includes(entry.name), 'Unexpected dataset content');
  const releaseRoot = resolve(regionRoot, 'releases');
  let versions = [];
  try { versions = await readdir(releaseRoot, {withFileTypes:true}); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  for (const version of versions) {
    assert(version.isDirectory() && /^gd1-[a-f0-9]{24}$/.test(version.name), 'Invalid version directory');
    const directory = resolve(releaseRoot, version.name), manifest = await json(resolve(directory, 'manifest.json'));
    publicData(manifest);
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.region, region); assert.equal(manifest.releaseId, version.name);
    const identity = {...manifest}; delete identity.releaseId; delete identity.collectedAt;
    assert.equal('gd1-' + hash(Buffer.from(JSON.stringify(sorted(identity)) + '\n')).slice(0,24), manifest.releaseId, 'Content identity');
    assert(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 512);
    const expected = new Set(['manifest.json']); let bytesTotal = 0;
    const entityIds = new Map(); let canonicalCoverage, canonicalRelations;
    for (const file of manifest.files) {
      assert(/^(?:exports\/(?:en|zh|tc|neutral)\/Export[A-Za-z0-9]+|reviewed\/[a-z0-9-]+|canonical\/[a-z0-9-]+|quality)\.json$/.test(file.path), 'Unapproved path');
      assert(!expected.has(file.path), 'Duplicate file'); expected.add(file.path);
      const bytes = await read(resolve(directory, file.path)); bytesTotal += bytes.length;
      assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256, file.path);
      const content = JSON.parse(bytes); publicData(content);
      assert.equal(content.region, region); assert.equal(content.schemaVersion, 1);
      if (file.path.startsWith('exports/')) { assert.equal(content.locale, file.path.split('/')[1]); assert(content.sections && !Array.isArray(content.sections)); }
      if (file.path.startsWith('canonical/')) assert.equal(content.model, 'regional-catalog-v1');
      if (file.path.startsWith('canonical/entities-')) {
        assert(Array.isArray(content.entities));
        for (const entity of content.entities) {
          assert.equal(entity.section, content.section);
          assert.equal(entity.key, `${entity.section}|${entity.id}`);
          assert(typeof entity.id === 'string' && entity.id.length > 0 && !entityIds.has(entity.key));
          entityIds.set(entity.key, entity.id);
          assert(entity.variants && entity.names && Array.isArray(entity.provenance) && entity.provenance.length > 0);
          for (const source of entity.provenance) {
            assert(source.section === entity.section && Number.isInteger(source.index) && source.index >= 0);
            assert(Object.hasOwn(entity.variants, source.locale));
            assert(manifest.files.some(f => f.path === source.path && f.sha256 === source.sha256), 'Provenance file/hash');
          }
        }
      }
      if (file.path === 'canonical/coverage.json') canonicalCoverage = content;
      if (file.path === 'canonical/relations.json') canonicalRelations = content;
    }
    assert(bytesTotal <= 384 * 1024 * 1024); assert(expected.has('quality.json'));
    if (manifest.canonicalModel || entityIds.size) {
      assert.equal(manifest.canonicalModel, 'regional-catalog-v1');
      assert(manifest.capabilities.includes('regional-catalog-v1'));
      assert(canonicalCoverage && canonicalRelations);
      assert.equal(canonicalCoverage.entities, entityIds.size); assert(entityIds.size > 0);
      const counts = {};
      for (const relation of canonicalRelations.relations) {
        assert(entityIds.has(relation.source)); assert(Array.isArray(relation.candidates));
        for (const key of relation.candidates) assert.equal(entityIds.get(key), relation.targetId);
        assert.equal(relation.resolution, relation.candidates.length === 0 ? 'UNRESOLVED' : relation.candidates.length === 1 ? 'RESOLVED' : 'AMBIGUOUS');
        counts[relation.resolution] = (counts[relation.resolution] ?? 0) + 1;
      }
      assert.deepEqual(counts, canonicalCoverage.relationCounts);
      assert.equal(canonicalCoverage.features.catalogQuery, 'AVAILABLE');
    }
    assert.equal((await json(resolve(directory, 'quality.json'))).status, 'PASS');
    for (const path of await walk(directory)) assert(expected.delete(relative(directory, path).split(sep).join('/')), 'Unlisted file');
    assert.equal(expected.size, 0); releases++;
  }
  if (entries.some(e => e.name === 'latest.json')) {
    const latest = await json(resolve(regionRoot, 'latest.json'));
    assert.equal(latest.region, region); assert.equal(latest.schemaVersion, 1);
    assert(/^gd1-[a-f0-9]{24}$/.test(latest.releaseId));
    assert.equal(latest.manifest, `datasets/${region}/releases/${latest.releaseId}/manifest.json`);
    assert.equal(hash(await read(resolve(root, latest.manifest))), latest.manifestSha256);
  }
}
console.log(`PASS: ${releases} immutable release(s); region isolation and file integrity verified.`);
