// Local-only check of native 3.0.1 -> 3.0.0 downgrades against the game-tested private outputs.
// Saves stay outside this repository and CI artifacts. Pass the private project root.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {repairSave,inspectSave} from '../dist/repair.mjs';
import {DOWNGRADE_PROFILE as profile} from '../dist/profiles.mjs';
const root=process.argv[2];
if(!root)throw Error('Pass the private savegame project root.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
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
  assert.equal(hash(result.data),hash(expected),`${input}: output differs from the game-tested file`);
  assert.equal(inspectSave(result.data,{profile}).status,'current');
  assert.equal(hash(repairSave(result.data,{profile}).data),hash(result.data),'Conversion must be idempotent');
  const r=result.nativeDowngrade;
  console.log(`${path.basename(input)}: identical to game-tested output (${r.units} units, ${r.projectilesReversed} projectiles, ${r.pendingWaits} pending waits, ${Math.round(performance.now()-started)} ms).`);
}
