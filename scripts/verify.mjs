import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile, readdir, lstat} from 'node:fs/promises';
import {resolve, relative, sep} from 'node:path';
import {fileURLToPath} from 'node:url';
import {NativeIdentities} from './native-identities.mjs';
import {NativeDojo} from './native-dojo.mjs';
import {NativeTextIcons} from './native-text-icons.mjs';
import {verifyScopedLinks} from './native-scoped-links.mjs';
import {verifyRecipeQuantityAncestry} from './native-recipe-quantity.mjs';
import {NativeItemParents} from './native-item-parents.mjs';
import {NativeNpc} from './native-npc.mjs';
import {NativeAiWeapons} from './native-ai-weapons.mjs';
import {NativeCodex} from './native-codex.mjs';
import {NativeIntrinsics} from './native-intrinsics.mjs';
import {NativeIntrinsicUi} from './native-intrinsic-ui.mjs';
import {NativeDictionaries} from './native-dictionaries.mjs';
import {unpackDictionary} from './dictionary-encoding.mjs';
import {NativeChallengeSelection} from './native-challenge-selection.mjs';
import {NativeRewards} from './native-rewards.mjs';
import {NativeArbitration} from './native-arbitration.mjs';
import {verifyWeaponStoreTraits} from './native-weapon-store-traits.mjs';
import {verifyCurrencyContent} from './native-currency-content.mjs';
import {NativeEnemyDrops} from './native-enemy-drops.mjs';
import {verifyPalettes} from './native-palettes.mjs';
import {verifyRailjack} from './native-railjack.mjs';
import {verifyLevelJobBindings} from './native-level-job-bindings.mjs';
import {verifyModDescriptionRules} from './native-mod-description-rules.mjs';
import {verifyModSetDescriptionRules} from './native-mod-set-description-rules.mjs';
import {verifyCustomModDescriptionRules} from './native-custom-mod-description-rules.mjs';
import {expandRelation} from './canonical-relations.mjs';
import {expandEntities} from './canonical-entities.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const regions = new Set(['international', 'china']);
const privateFields = new Set(['password','passwd','appsecret','apikey','accesstoken','clientsecret','authorization','cookie','privatekey']);
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
    assert(!privateFields.has(key.toLowerCase().replace(/[_-]/g, '')), 'Credential field');
    publicData(item);
  } else if (typeof value === 'string') {
    assert(!/PRIVATE KEY-----|gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|[A-Za-z]:[\\/](?:Users|dev|ProjectSekaiAcceptance)[\\/]|(?:postgres(?:ql)?|mongodb(?:\+srv)?):\/\//.test(value), 'Private content');
  }
}
async function verifyRelease(directory, region, version) {
  const stat = await lstat(directory); assert(stat.isDirectory() && !stat.isSymbolicLink(), 'Unsafe release directory');
    const manifest = await json(resolve(directory, 'manifest.json'));
    publicData(manifest);
    assert.equal(manifest.schemaVersion, 1); assert.equal(manifest.region, region); assert.equal(manifest.releaseId, version);
    const identity = {...manifest}; delete identity.releaseId; delete identity.collectedAt;
    assert.equal('gd1-' + hash(Buffer.from(JSON.stringify(sorted(identity)) + '\n')).slice(0,24), manifest.releaseId, 'Content identity');
    assert(Array.isArray(manifest.files) && manifest.files.length > 0 && manifest.files.length <= 512);
    const expected = new Set(['manifest.json']); let bytesTotal = 0;
    const entityIds = new Map(), relationShards = new Map(), sourceReferences = new Map(); let canonicalCoverage;
    const nativeIdentities = new NativeIdentities();
    const nativeDojo = new NativeDojo();
    const nativeTextIcons = new NativeTextIcons();
    const nativeItemParents = new NativeItemParents();
    const nativeNpc = new NativeNpc();
    const nativeAiWeapons = new NativeAiWeapons();
    const nativeCodex = new NativeCodex();
    const nativeIntrinsics = new NativeIntrinsics();
    const nativeIntrinsicUi = new NativeIntrinsicUi();
    const nativeDictionaries = new NativeDictionaries();
    const nativeChallengeSelection = new NativeChallengeSelection();
    const nativeRewards = new NativeRewards();
    const nativeEnemyDrops = new NativeEnemyDrops();
    const nativeArbitration = new NativeArbitration();
    let rivenProfiles, weaponParameters, rivenCoverage;
    for (const file of manifest.files) {
      assert(/^(?:exports\/(?:en|zh|tc|neutral)\/Export[A-Za-z0-9]+|exports\/(?:de|es|fr|it|ja|ko|pl|pt|ru|th|tr|uk)\/ExportClientDictionary|reviewed\/[a-z0-9-]+|canonical\/[a-z0-9-]+|quality)\.json$/.test(file.path), 'Unapproved path');
      assert(!expected.has(file.path), 'Duplicate file'); expected.add(file.path);
      const bytes = await read(resolve(directory, file.path)); bytesTotal += bytes.length;
      assert(bytesTotal <= 512 * 1024 * 1024, 'Regional release exceeds size budget');
      assert.equal(bytes.length, file.bytes); assert.equal(hash(bytes), file.sha256, file.path);
      let content = JSON.parse(bytes);
      if(file.path.endsWith('/ExportClientDictionary.json'))content={...content,
        sections:{...content.sections,ClientDictionary:unpackDictionary(content.sections.ClientDictionary)}};
      publicData(content);
      nativeRewards.accept(file.path, content);
      nativeArbitration.accept(file.path, content);
      verifyWeaponStoreTraits(file.path, content);
      verifyCurrencyContent(file.path, content);
      verifyPalettes(content);
      verifyRailjack(content);
      verifyLevelJobBindings(content,manifest);
      if(content.sections?.ClientModDescriptionRules) assert.equal(file.path,'exports/neutral/ExportClientModDescriptionRules.json');
      verifyModDescriptionRules(content,manifest);
      if(content.sections?.ClientModSetDescriptionRules!==undefined) assert.equal(file.path,'exports/neutral/ExportClientModSetDescriptionRules.json');
      verifyModSetDescriptionRules(content,manifest);
      if(content.sections?.ClientCustomModDescriptionRules!==undefined) assert.equal(file.path,'exports/neutral/ExportClientCustomModDescriptionRules.json');
      verifyCustomModDescriptionRules(content,manifest);
      nativeEnemyDrops.accept(file.path, content);
      nativeTextIcons.accept(file.path, content);
      nativeItemParents.accept(file.path, content);
      nativeNpc.accept(file.path, content);
      nativeAiWeapons.accept(file.path, content);
      nativeCodex.accept(file.path, content);
      nativeIntrinsics.accept(file.path, content);
      nativeIntrinsicUi.accept(file.path, content);
      nativeDictionaries.accept(file.path, content);
      nativeChallengeSelection.accept(file.path, content);
      if (file.path.startsWith('exports/')) verifyScopedLinks(content.sections);
      if (file.path.startsWith('exports/')) verifyRecipeQuantityAncestry(content.sections);
      assert.equal(content.region, region); assert.equal(content.schemaVersion, 1);
      if (file.path.startsWith('exports/')) { assert.equal(content.locale, file.path.split('/')[1]); assert(content.sections && !Array.isArray(content.sections)); }
      if (file.path.startsWith('exports/')) nativeIdentities.accept(content);
      if (file.path.startsWith('exports/')) nativeDojo.accept(content);
      if (file.path.endsWith('/ExportDropTables.json')) {
        assert.equal(region, 'international', 'Official PC drop tables cannot supply China');
        assert.equal(file.path, 'exports/en/ExportDropTables.json');
        assert.equal(content.sourceId, 'ExportDropTables');
        assert.equal(content.sections.OfficialDropTables?.formatVersion, 1);
        const data=content.sections.OfficialDropTables;
        const sectionIds=new Set(['missionRewards','relicRewards','keyRewards','transientRewards','sortieRewards',
          'cetusRewards','solarisRewards','deimosRewards','zarimanRewards','entratiLabRewards','hexRewards',
          'modByAvatar','modByDrop','blueprintByAvatar','blueprintByDrop','resourceByAvatar','resourceByDrop',
          'sigilByAvatar','additionalItemByAvatar','relicByAvatar']);
        assert(/^\d{4}-\d{2}-\d{2}$/.test(data.publishedDate));
        assert(Array.isArray(data.tables)&&data.tables.length===sectionIds.size);
        const percentage=(value,max)=>assert(Number.isFinite(value)&&value>=0&&value<=max,'Invalid drop percentage');
        let rows=0,lastRow=0;
        for(const table of data.tables) {
          assert(sectionIds.delete(table.id),'Unknown/duplicate drop section');
          const inverse=table.id.endsWith('ByDrop');
          assert.equal(table.direction,inverse?'ITEM_TO_SOURCE':'SOURCE_TO_ITEM');
          assert(Array.isArray(table.groups)&&table.groups.length>0);
          for(const group of table.groups) {
            for(const field of ['subject','rotation','stage','condition']) assert(typeof group[field]==='string'&&group[field].length<=2048,'Missing drop context');
            assert(group.subject.trim());
            if(Object.hasOwn(group,'poolGatePercent'))percentage(group.poolGatePercent,10000);
            assert(Array.isArray(group.entries)&&group.entries.length>0);
            assert.equal(group.sourceRow,group.entries[0].sourceRow);
            for(const entry of group.entries) {
              assert(++rows<=100000&&Number.isSafeInteger(entry.sourceRow)&&entry.sourceRow>lastRow&&entry.sourceRow<=150000);
              lastRow=entry.sourceRow;
              for(const field of ['label','rarity']) assert(typeof entry[field]==='string'&&entry[field].trim());
              percentage(entry.probabilityPercent,100);
              if(inverse)percentage(entry.poolGatePercent,10000);else assert(!Object.hasOwn(entry,'poolGatePercent'));
              assert(!Object.hasOwn(entry,'underReview')||typeof entry.underReview==='boolean');
              assert.equal(entry.underReview??false,entry.rarity.includes('Under Review'));
            }
          }
        }
      }
      if (file.path.startsWith('canonical/')) {
        assert(['regional-catalog-v1', 'regional-catalog-v2', 'regional-catalog-v3', 'regional-catalog-v4', 'regional-catalog-v5'].includes(content.model));
        assert.equal(content.model, manifest.canonicalModel);
      }
      if (file.path.startsWith('canonical/entities-')) {
        content=expandEntities(content);
        assert(Array.isArray(content.entities));
        for (const entity of content.entities) {
          assert.equal(entity.section, content.section);
          assert.equal(entity.key, `${entity.section}|${entity.id}`);
          assert(typeof entity.id === 'string' && entity.id.length > 0 && !entityIds.has(entity.key));
          entityIds.set(entity.key, entity.id);
          const compact = ['regional-catalog-v3','regional-catalog-v4','regional-catalog-v5'].includes(content.model);
          assert(entity.names && Array.isArray(entity.provenance) && entity.provenance.length > 0);
          if (compact) {
            assert(!Object.hasOwn(entity,'variants') && entity.variantSources && entity.descriptions);
            assert(Object.keys(entity.variantSources).length > 0);
            assert.deepEqual(Object.keys(entity.variantSources).sort(), Object.keys(entity.names).sort());
            assert.deepEqual(Object.keys(entity.variantSources).sort(), Object.keys(entity.descriptions).sort());
            for (const [locale, source] of Object.entries(entity.variantSources)) {
              assert.equal(source.locale, locale);
              assert(entity.provenance.some(p => JSON.stringify(sorted(p)) === JSON.stringify(sorted(source))), 'Primary provenance');
            }
          } else assert(entity.variants);
          for (const source of entity.provenance) {
            assert(source.section === entity.section && Number.isInteger(source.index) && source.index >= 0);
            assert(Object.hasOwn(compact ? entity.variantSources : entity.variants, source.locale));
            assert(manifest.files.some(f => f.path === source.path && f.sha256 === source.sha256), 'Provenance file/hash');
            if (compact) {
              assert(/^exports\/(?:en|zh|tc|neutral)\/Export[A-Za-z0-9]+\.json$/.test(source.path));
              assert.equal(source.locale, source.path.split('/')[1]);
              if (!sourceReferences.has(source.path)) sourceReferences.set(source.path, []);
              sourceReferences.get(source.path).push({source,id:entity.id,name:entity.names[source.locale],description:entity.descriptions[source.locale]});
            }
          }
        }
      }
      if (file.path === 'canonical/coverage.json') canonicalCoverage = content;
      if (/^canonical\/relations(?:-\d{4})?\.json$/.test(file.path)) {
        assert(Array.isArray(content.relations));
        if(['regional-catalog-v4','regional-catalog-v5'].includes(content.model))assert.equal(content.relationEncoding,'target-identity-elision-v1');
        relationShards.set(file.path, content);
      }
      if (file.path === 'exports/neutral/ExportClientRivenProfiles.json') rivenProfiles = content.sections.ClientRivenProfiles;
      if (file.path === 'exports/neutral/ExportClientWeaponParameters.json') weaponParameters = content.sections.ClientWeaponParameters;
      if (file.path === 'exports/neutral/ExportClientRivenCoverage.json') rivenCoverage = content.sections.ClientRivenCoverage;
    }
    assert(expected.has('quality.json'));
    const identityAnchors = nativeIdentities.verify();
    nativeDojo.verify();
    nativeTextIcons.verify(manifest.capabilities?.includes('client-text-icons-v1')??false);
    nativeItemParents.verify(manifest.capabilities?.includes('client-item-parents-v1')??false);
    nativeNpc.verify(manifest.capabilities?.includes('client-npc-facts-v1')??false);
    nativeAiWeapons.verify(manifest.capabilities?.includes('client-ai-weapon-facts-v1')??false);
    nativeCodex.verify(manifest.capabilities?.includes('client-codex-v1')??false);
    nativeIntrinsics.verify(manifest.capabilities?.includes('client-intrinsic-tables-v1')??false);
    nativeIntrinsicUi.verify(manifest.capabilities?.includes('client-intrinsic-ui-v1')??false);
    nativeDictionaries.verify(manifest.capabilities?.includes('client-complete-dictionaries-v1')??false,manifest);
    nativeChallengeSelection.verify(manifest.capabilities?.includes('client-challenge-selection-facts-v1')??false);
    nativeRewards.verify(manifest.capabilities?.includes('client-mission-reward-manifests-v1')??false, manifest);
    nativeArbitration.verify(manifest);
    nativeEnemyDrops.verify(manifest);
    // One original file at a time: indices never require all full export trees to remain resident.
    for (const [path, references] of sourceReferences) {
      const bytes = await read(resolve(directory, path));
      assert.equal(hash(bytes), manifest.files.find(file => file.path === path).sha256, 'Original changed during verification');
      const data = JSON.parse(bytes);
      for (const {source,id,name,description} of references) {
        assert.equal(data.region,region); assert.equal(data.locale,source.locale);
        const records = data.sections?.[source.section];
        assert(Array.isArray(records) && source.index < records.length, 'Source record index');
        const record = records[source.index];
        const identity = ['uniqueName','abilityUniqueName','node'].map(key => record[key]).find(value => typeof value === 'string' && value.trim());
        assert.equal(identity,id,'Source identity');
        const label = Object.hasOwn(record,'name') ? record.name : record.abilityName;
        assert.equal(typeof label === 'string' ? label : null,name,'Source name');
        assert.deepEqual(record.description ?? null,description,'Source description');
      }
    }
    if (manifest.capabilities.includes('client-riven-facts-v1')) {
      assert(Array.isArray(rivenProfiles) && Array.isArray(weaponParameters) && rivenCoverage);
      assert.equal(rivenProfiles.length, rivenCoverage.profileFamilies);
      assert.equal(new Set(rivenProfiles.map(p => p.uniqueName)).size, rivenProfiles.length);
      assert.equal(rivenProfiles.reduce((sum,p) => sum + p.traits.length, 0), rivenCoverage.traits);
      assert.equal(weaponParameters.length, rivenCoverage.weapons);
      assert.equal(new Set(weaponParameters.map(p => p.uniqueName)).size, weaponParameters.length);
      assert.equal(weaponParameters.filter(p => p.values.OmegaAttenuation !== null).length, rivenCoverage.explicitDisposition);
      assert.deepEqual(weaponParameters.filter(p => p.values.OmegaAttenuation === null).map(p => p.uniqueName), rivenCoverage.unknownDisposition);
      for (const profile of rivenProfiles) {
        assert(profile.fieldSources && profile.values && profile.traitsSource);
        assert.equal(new Set(profile.traits.map(t => t.Tag)).size, profile.traits.length);
        for (const trait of profile.traits) for (const entry of trait.upgrades) assert(Number.isFinite(entry.upgrade.Value));
      }
    }
    if (manifest.canonicalModel || entityIds.size) {
      assert(['regional-catalog-v1', 'regional-catalog-v2', 'regional-catalog-v3', 'regional-catalog-v4', 'regional-catalog-v5'].includes(manifest.canonicalModel));
      assert(manifest.capabilities.includes(manifest.canonicalModel));
      assert(canonicalCoverage && relationShards.has('canonical/relations.json'));
      if (manifest.canonicalModel !== 'regional-catalog-v1') {
        assert.deepEqual([...canonicalCoverage.relationFiles].sort(), [...relationShards.keys()].sort());
      } else assert.equal(relationShards.size, 1);
      assert.equal(canonicalCoverage.entities, entityIds.size); assert(entityIds.size > 0);
      const counts = {};
      for (const shard of relationShards.values()) for (const row of shard.relations) {
        const relation=expandRelation(shard,row);
        assert(entityIds.has(relation.source)); assert(Array.isArray(relation.candidates));
        for (const key of relation.candidates) assert.equal(entityIds.get(key), relation.targetId);
        if (relation.candidates.some(key=>key.startsWith('ClientItemIdentities|')) || relation.targetRule==='explicit-store-typename-v1') {
          assert(identityAnchors.has(relation.targetId),'Unknown natural identity anchor');
          assert.deepEqual(relation.candidates,[`ClientItemIdentities|${relation.targetId}`]);
          assert.equal(relation.targetRule,'explicit-store-typename-v1');
        }
        assert.equal(relation.resolution, relation.candidates.length === 0 ? 'UNRESOLVED' : relation.candidates.length === 1 ? 'RESOLVED' : 'AMBIGUOUS');
        counts[relation.resolution] = (counts[relation.resolution] ?? 0) + 1;
      }
      assert.deepEqual(counts, canonicalCoverage.relationCounts);
      assert.equal(canonicalCoverage.features.catalogQuery, 'AVAILABLE');
    }
    assert.equal((await json(resolve(directory, 'quality.json'))).status, 'PASS');
    for (const path of await walk(directory)) assert(expected.delete(relative(directory, path).split(sep).join('/')), 'Unlisted file');
    assert.equal(expected.size, 0);
}
const args = process.argv.slice(2);
if (args.length) {
  assert(args.length === 2 && args[0] === '--release', 'Usage: node scripts/verify.mjs [--release DIRECTORY]');
  const directory = resolve(args[1]), manifest = await json(resolve(directory, 'manifest.json'));
  assert(regions.has(manifest.region), 'Unknown release region');
  await verifyRelease(directory, manifest.region, manifest.releaseId);
  console.log('PASS: standalone regional release integrity and canonical relations verified.');
} else {
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
    await verifyRelease(resolve(releaseRoot, version.name), region, version.name); releases++;
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
}
