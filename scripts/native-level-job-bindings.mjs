import assert from 'node:assert/strict';
export function verifyLevelJobBindings(data,manifest) {
  const rows=data.sections?.ClientLevelJobBindings;if(rows===undefined)return;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length===1,'level job inventory');
  const row=rows[0],level='/Lotus/Levels/CivilianHubs/VenusTownSolarisUnited.level',s=row.source,p=row.propertyRecord;
  const number=(v,a,b)=>Number.isSafeInteger(v)&&v>=a&&v<=b;
  const hash=v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
  assert(row.schema==='native-level-job-binding-v1'&&row.uniqueName===level,'level job identity');
  assert(s?.cache==='B.AnimRetarget'&&s.resource===level&&number(s.bytes,1,2*1024*1024)
    &&[s.tocSha256,s.compressedSha256,s.decodedSha256].every(hash),'level job source');
  assert(typeof s.stamp==='string'&&/^[1-9][0-9]{0,19}$/.test(s.stamp),'level job stamp');
  let visited=0,acquired=false;
  function visit(node,depth=0) {
    assert(node&&typeof node==='object'&&!Array.isArray(node)&&depth<=16&&++visited<=128,'level provenance bounds');
    const records=node.clientExtraction?.sourceRecords;
    if(records!==undefined){assert(Array.isArray(records)&&records.length<=16384);for(const record of records)
      if(record.cache===s.cache&&record.resource===s.resource){for(const key of ['cache','resource','bytes','stamp','tocSha256','compressedSha256','decodedSha256'])
        assert.deepEqual(record[key],s[key],'level source acquisition conflict');acquired=true;}}
    if(node.inputs!==undefined){assert(Array.isArray(node.inputs)&&node.inputs.length<=16);for(const input of node.inputs)visit(input,depth+1);}
  }
  visit(manifest);assert(acquired,'level source acquisition missing');
  assert(p&&number(p.offset,1,2*1024*1024)&&number(p.bytes,1,16384)&&number(p.instance,0,99999)
    &&p.offset+p.bytes<s.bytes&&hash(p.sha256),'level job record extent');
  const e=row.executor,v=row.values;
  assert(e?.Script==='/Lotus/Scripts/ExecuteSelf.lua'&&e.Function==='ExecuteSelf'
    &&['_sleepFrames','_waitForGame','_waitForRJ','_waitForLoginDone'].every(k=>e[k]===0)&&e._allowRestart===1
    &&row.replicaRunScriptInstance===1&&row.target==='','level job executor');
  assert(v?.Script==='/Lotus/Scripts/Eidolon/TownNpcs/JobNpc.lua'&&v.Function==='JobNpc'
    &&v._townSyndicate==='/Lotus/Syndicates/Solaris/SolarisSyndicate'
    &&v._townJobManifest==='/Lotus/Types/Gameplay/Venus/Jobs/VenusJobManifest'
    &&v._inTown===1&&v._allowContinuousJobs===1&&v._sharedHub===0&&v._minEnemyLevel===0&&v._maxEnemyLevel===0,'level job context');
  assert.deepEqual(v._nokkoSteelpathRewards,['','B','C'].map(s=>'/Lotus/Types/Game/MissionDecks/NokkoColonyRewards/NokkoColonyRewardsSteel'+s),'level job ordered rewards');
}
