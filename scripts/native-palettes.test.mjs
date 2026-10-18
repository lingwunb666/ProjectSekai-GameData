import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {verifyPalettes} from './native-palettes.mjs';
function fixture() {
  const id='/Lotus/Palette',resource='/Lotus/picker.png',body=Buffer.alloc(12);
  body.writeUInt32LE(1);body.writeUInt32LE(0xffd92e2f,4);
  return {locale:'neutral',sections:{ClientColorPalettes:[{uniqueName:id,rule:'native-palette-binding-v1',format:'native-packed-color-palette-v1',nativeType:6,
    resourceChain:[id,'/Lotus/Types/Items/ColorPickerItem'],binding:{owner:id,field:'PickerImage',rawTarget:'picker.png',resourceTarget:resource},
    source:{resource,cache:'H.Misc'},sourcePaths:[resource],colors:[0xffd92e2f],auxiliaryWords:[],attributes:{LegacyGamma:1},
    legacyRgbColors:[0xed7576],legacyRgbRule:'round-255-pow-rgb-over-255-inverse-2.2-v1',bodyBytes:12,
    bodySha256:createHash('sha256').update(body).digest('hex')}]}};
}
test('palette raw channels and separate gamma view remain immutable',()=>{const x=fixture(),before=structuredClone(x);verifyPalettes(x);assert.deepEqual(x,before);});
test('palette body edits, gamma edits, duplicate identities and missing field owners are rejected',()=>{
  for(const change of [r=>r.colors[0]++,r=>r.colors[0]+=0x100000000,r=>r.legacyRgbColors[0]++,r=>r.binding.owner='/Lotus/Other',r=>r.nativeType=163]){
    const x=fixture();change(x.sections.ClientColorPalettes[0]);assert.throws(()=>verifyPalettes(x));}
  const x=fixture();x.sections.ClientColorPalettes.push(x.sections.ClientColorPalettes[0]);assert.throws(()=>verifyPalettes(x));
});
