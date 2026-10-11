// Local-only check of native 3.0.1 -> 3.0.0 downgrades against the game-tested private outputs.
// Saves stay outside this repository and CI artifacts. Pass the private project root.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {repairSave,inspectSave,restoreAssetFlag,inflateBlock} from '../dist/repair.mjs';
import {DOWNGRADE_PROFILE as profile} from '../dist/profiles.mjs';
const root=process.argv[2];
if(!root)throw Error('Pass the private savegame project root.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expand=data=>{const v=new DataView(data.buffer,data.byteOffset,data.byteLength),parts=[];
  for(let i=0,pos=68;i<v.getUint32(44,true);i++){const size=v.getUint32(pos,true);parts.push(inflateBlock(data.subarray(pos+12,pos+12+size),1048576));pos+=12+size;}
  return Buffer.concat(parts);};
const f32=(bytes,at)=>bytes.readFloatLE(at);
// The game-tested files predate the hero armor repair. Compare against them directly:
// the payloads may differ only in the two 4-byte armor caches of each reported hero, the old
// values must be the reported ones, and the new ones must equal .30*Agility-2 and the unit
// total shifted by the same amount. Everything else, including the saved Lua, is identical.
function assertArmorOnlyDiff(input,result,expected){
  const a=expand(result.data),b=expand(expected),changes=result.nativeDowngrade.heroArmorChanges;
  assert.equal(a.length,b.length,`${input}: payload length differs`);
  assert.deepEqual([...result.data.subarray(0,32),...result.data.subarray(36,64)],[...expected.subarray(0,32),...expected.subarray(36,64)],`${input}: container header differs`);
  const windows=new Set();
  for(const c of changes){
    assert.equal(f32(b,c.armorOffset),c.from,`${input}: unexpected original hero armor`);
    assert.equal(f32(a,c.armorOffset),Math.fround(.30*c.agility-2),`${input}: hero armor not .30*Agility-2`);
    assert.equal(f32(b,c.unitArmorOffset),c.unitFrom,`${input}: unexpected original unit armor`);
    assert.equal(f32(a,c.unitArmorOffset),Math.fround(c.unitFrom+(c.to-c.from)),`${input}: unit armor not shifted by the hero change`);
    for(const w of [c.armorOffset,c.unitArmorOffset])for(let i=w;i<w+4;i++)windows.add(i);
  }
  for(let i=0;i<a.length;i++)if(a[i]!==b[i])assert.ok(windows.has(i),`${input}: payload byte ${i} differs outside the armor caches`);
  if(!changes.length)assert.equal(hash(result.data),hash(expected),`${input}: output differs from the game-tested file`);
}
const tests='output/downgrade-tests',neo='Savegame_Backups/neo',diagnosis='output/forsaken-save-recovery/scarlet-diagnosis';
// Each expected output was loaded, re-saved and reloaded in restored 3.0.0.
for(const [input,golden] of [
  [`${diagnosis}/scarlet_after_patch.w3z`,`${tests}/native-candidates/scarlet_native_start_downgraded.w3z`],
  [`${neo}/scarlet_neo(1)_repaired_savegame_played_further.w3z`,`${tests}/native-candidates/scarlet_further1_downgraded.w3z`],
  [`${neo}/scarlet_neo(1)_repaired_savegame_played_further_2.w3z`,`${tests}/native-candidates-v2/scarlet_further2_v2.w3z`],
  [`${neo}/scarlet_neo(1)_repaired_savegame_played_further_3.w3z`,`${tests}/native-candidates-v2/scarlet_further3_v2.w3z`],
  [`${diagnosis}/scarlet_4_missile_resaved.w3z`,`${tests}/native-candidates-v2/scarlet_native4_v2.w3z`],
  [`${neo}/scarlet_neo(1)_repaired_savegame_played_further_4_State_of_(6).w3z`,`${tests}/native-candidates-v2/scarlet_boss_v2.w3z`],
]){
  const source=new Uint8Array(await readFile(path.join(root,input))),expected=new Uint8Array(await readFile(path.join(root,golden)));
  const started=performance.now(),result=repairSave(source,{profile});
  assertArmorOnlyDiff(input,result,expected);
  const verified=inspectSave(result.data,{profile});
  assert.ok(verified.status==='current'||verified.flagOnly,'Converted output must be current apart from the 3.0.0 header flag');
  // Exports also restore the header flag; that changes exactly one byte and is idempotent.
  const flagged=restoreAssetFlag(result.data,{profile}).data,after=inspectSave(flagged,{profile});
  assert.equal(after.status,'current');assert.equal(after.assetFlag===null||after.assetFlag===4,true);
  assert.equal(hash(repairSave(flagged,{profile}).data),hash(flagged),'Conversion must be idempotent');
  const r=result.nativeDowngrade;
  console.log(`${path.basename(input)}: matches the game-tested output except ${r.heroArmorRepairs*2} verified armor caches (${r.units} units, ${r.projectilesReversed} projectiles, ${r.pendingWaits} pending waits, ${Math.round(performance.now()-started)} ms).`);
}
