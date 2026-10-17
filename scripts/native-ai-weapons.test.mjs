import test from 'node:test';import assert from 'node:assert/strict';
import {NativeAiWeapons,expandAiProjectile} from './native-ai-weapons.mjs';
test('AI projectile decoder preserves zero and rejects missing/overlapping unknown declarations',()=>{
  const shot={uniqueName:'/Lotus/Shot',schema:'native-projectile-facts-v2',encoding:'native-projectile-unknown-fields-v1',
    unknownFields:'unknown-fields-0',resourceChain:['/Lotus/Shot'],values:{DamageRadius:0},
    attacks:{AttackData:{sourceFormat:'native-attack-facts-v2'}},fieldSources:{DamageRadius:{resource:'/Lotus/Shot',field:'DamageRadius'}}};
  const profile={uniqueName:'unknown-fields-0',fields:['CriticalChance','AttackData.Amount']},
    binding={uniqueName:'/Lotus/Shot',reference:'Shot',referenceOwner:'/Lotus/Owner'};
  const raw=expandAiProjectile(shot,profile,binding);assert.equal(raw.values.DamageRadius,0);assert.equal(raw.values.CriticalChance,null);
  assert.equal(raw.attacks.AttackData.Amount,null);assert.equal(raw.referenceOwner,'/Lotus/Owner');
  assert.throws(()=>expandAiProjectile(shot,null,binding));
  assert.throws(()=>expandAiProjectile(shot,{...profile,fields:[...profile.fields,'DamageRadius']},binding));
  assert.throws(()=>expandAiProjectile(shot,profile,{...binding,uniqueName:'/Lotus/AnotherShot'}));
  new NativeAiWeapons().verify(false);assert.throws(()=>new NativeAiWeapons().verify(true));
});
