import test from 'node:test';
import assert from 'node:assert/strict';
import {verifyLevelJobBindings} from './native-level-job-bindings.mjs';
const level='/Lotus/Levels/CivilianHubs/VenusTownSolarisUnited.level';
function fixture(){return {locale:'neutral',sections:{ClientLevelJobBindings:[{schema:'native-level-job-binding-v1',uniqueName:level,
  source:{cache:'B.AnimRetarget',resource:level,bytes:5000,stamp:'12345',tocSha256:'a'.repeat(64),compressedSha256:'b'.repeat(64),decodedSha256:'c'.repeat(64)},
  propertyRecord:{offset:10,bytes:1000,instance:12,sha256:'d'.repeat(64)},
  executor:{Script:'/Lotus/Scripts/ExecuteSelf.lua',Function:'ExecuteSelf',_sleepFrames:0,_waitForGame:0,_waitForRJ:0,_waitForLoginDone:0,_allowRestart:1},
  replicaRunScriptInstance:1,target:'',values:{Script:'/Lotus/Scripts/Eidolon/TownNpcs/JobNpc.lua',Function:'JobNpc',
    _townSyndicate:'/Lotus/Syndicates/Solaris/SolarisSyndicate',_townJobManifest:'/Lotus/Types/Gameplay/Venus/Jobs/VenusJobManifest',
    _inTown:1,_allowContinuousJobs:1,_sharedHub:0,_minEnemyLevel:0,_maxEnemyLevel:0,
    _nokkoSteelpathRewards:['','B','C'].map(s=>'/Lotus/Types/Game/MissionDecks/NokkoColonyRewards/NokkoColonyRewardsSteel'+s)}}]}};}
test('level source facts require exact bootstrap, order and bounded record provenance',()=>{
  const manifest={inputs:[{clientExtraction:{sourceRecords:[fixture().sections.ClientLevelJobBindings[0].source]}}]};
  assert.doesNotThrow(()=>verifyLevelJobBindings(fixture(),manifest));
  assert.throws(()=>verifyLevelJobBindings(fixture(),{}));
  for(const mutate of [r=>r.values._nokkoSteelpathRewards.reverse(),r=>r.executor._waitForRJ=1,
    r=>r.propertyRecord.offset=5000,r=>r.values._townSyndicate='/Other',r=>r.values._inTown=null]) {
    const data=fixture();mutate(data.sections.ClientLevelJobBindings[0]);assert.throws(()=>verifyLevelJobBindings(data,manifest));
  }
});
