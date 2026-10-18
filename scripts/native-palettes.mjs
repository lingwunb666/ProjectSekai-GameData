import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function verifyPalettes(data) {
  const rows=data.sections?.ClientColorPalettes;if(rows===undefined)return;
  assert(data.locale==='neutral'&&Array.isArray(rows)&&rows.length>0&&rows.length<=256,'palette inventory');const seen=new Set();
  for(const row of rows) {
    assert(row.rule==='native-palette-binding-v1'&&row.format==='native-packed-color-palette-v1'&&row.nativeType===6,'palette format');
    assert(typeof row.uniqueName==='string'&&row.uniqueName.startsWith('/Lotus/')&&!seen.has(row.uniqueName),'palette identity');seen.add(row.uniqueName);
    assert(Array.isArray(row.colors)&&row.colors.length>0&&row.colors.length<=1024&&Array.isArray(row.auxiliaryWords)&&row.auxiliaryWords.length<=1024,'palette arrays');
    const body=Buffer.alloc(8+4*(row.colors.length+row.auxiliaryWords.length));let at=0;
    for(const values of [row.colors,row.auxiliaryWords]) {body.writeUInt32LE(values.length,at);at+=4;for(const color of values) {
      assert(Number.isInteger(color)&&color>=0&&color<=0xffffffff,'palette uint32');body.writeUInt32LE(color,at);at+=4;
    }}
    assert.equal(row.bodyBytes,body.length);assert.equal(row.bodySha256,createHash('sha256').update(body).digest('hex'),'palette body hash');
    const b=row.binding;assert(Array.isArray(row.resourceChain)&&row.resourceChain.length<=100&&row.resourceChain[0]===row.uniqueName
      &&row.resourceChain.includes('/Lotus/Types/Items/ColorPickerItem')&&row.resourceChain.includes(b?.owner)&&b.field==='PickerImage','palette declaration');
    assert(b.resourceTarget.startsWith('/Lotus/')&&row.source?.resource===b.resourceTarget&&row.source.cache==='H.Misc'
      &&Array.isArray(row.sourcePaths)&&row.sourcePaths.includes(b.resourceTarget),'palette source');
    if(row.attributes?.LegacyGamma===1) {
      assert.equal(row.legacyRgbRule,'round-255-pow-rgb-over-255-inverse-2.2-v1');
      assert.deepEqual(row.legacyRgbColors,row.colors.map(c=>[16,8,0].reduce((v,s)=>v|(Math.round(255*Math.pow((c>>>s&255)/255,1/2.2))<<s),0)),'palette gamma bytes');
    } else {assert.equal(row.legacyRgbColors,null);assert.equal(row.legacyRgbRule,null);}
  }
}
