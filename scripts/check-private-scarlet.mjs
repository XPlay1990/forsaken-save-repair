// Local-only fixture checks. Saves stay outside this repository and CI artifacts.
import {readFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {repairSave,inspectSave,inflateBlock} from '../dist/repair.mjs';
import {companionReferenceScanner} from '../dist/checkpoint-bundle.mjs';
const root=process.argv[2];
if(!root)throw Error('Pass the private Scarlet fixture directory.');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const expanded=data=>{
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),parts=[];
  for(let i=0,pos=68;i<view.getUint32(44,true);i++){const size=view.getUint32(pos,true);parts.push(inflateBlock(data.subarray(pos+12,pos+12+size),view.getUint32(pos+4,true)));pos+=12+size;}
  return Buffer.concat(parts);
};
for(const [input,golden,count] of [
  ['Act Two - The Scarlet Monastery (2)_neo.w3z','scarlet_2_missile_layout_test.w3z',1],
  ['Act Two - The Scarlet Monastery (3).w3z','scarlet_3_missile_layout_test.w3z',3],
  ['Act Two - The Scarlet Monastery (4).w3z','scarlet_4_missile_layout_test.w3z',2],
  ['Act Two - The Scarlet Monastery (4)_repaired.w3z','scarlet_4_missile_layout_test.w3z',2],
  ['Act Two - The Scarlet Monastery (5)_neo.w3z','scarlet_5_missile_layout_test.w3z',5],
  ['Act Two - The Scarlet Monastery (1).w3z','Act Two - The Scarlet Monastery (1)_neo_test.w3z',0],
  ['Act Two - The Scarlet Monastery (6)_neo.w3z','Act Two - The Scarlet Monastery (6)_neo_test.w3z',0],
]){
  const original=new Uint8Array(await readFile(path.join(root,input))),expected=new Uint8Array(await readFile(path.join(root,golden)));
  const result=repairSave(original);
  assert.equal(result.projectileRepairs||0,count);
  assert.equal(hash(expanded(result.data)),hash(expanded(expected)),'Output payload differs from independent Python recovery');
  assert.equal(hash(result.data),hash(expected),'Output file differs from independent Python recovery');
  assert.equal(inspectSave(result.data).status,'current');
  assert.equal(hash(repairSave(result.data).data),hash(result.data),'Conversion must be idempotent');
  const scanner=companionReferenceScanner();inspectSave(original,{onExpandedBlock:raw=>scanner.scan(raw)});
  assert.equal(scanner.folders.size,1);assert.match([...scanner.folders][0],/^FKManualSaves\//);
  assert.equal(scanner.files.size,0,'A manual backup directory alone does not invent file dependencies');
  console.log(`${input}: ${count} projectile records; exact Python output, idempotence and saved FKManualSaves path passed.`);
}
const native=new Uint8Array(await readFile(path.join(root,'scarlet_4_missile_resaved.w3z')));
assert.equal(hash(repairSave(native).data),hash(native));
console.log('Game-resaved (4) remains byte-identical.');
