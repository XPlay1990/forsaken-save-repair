import test from 'node:test';
import assert from 'node:assert/strict';
import {inflateSync,constants as z} from 'node:zlib';
import {migrateSavePaths} from '../dist/path-migration.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {PROFILE} from '../dist/profiles.mjs';
import {fixture} from './save-fixture.mjs';
const BLOCK=1048576;
function logicalPayload(data){const view=new DataView(data.buffer,data.byteOffset,data.byteLength),chunks=[];let pos=68;for(let i=0;i<view.getUint32(44,true);i++){const length=view.getUint32(pos,true);chunks.push(inflateSync(data.subarray(pos+12,pos+12+length),{finishFlush:z.Z_SYNC_FLUSH}));pos+=12+length;}return Buffer.concat(chunks).subarray(0,view.getUint32(40,true));}
function expectedPayload(source,records,target){const raw=logicalPayload(source),parts=[];let pos=0;for(const record of records){const text=Buffer.from(record.text),match=record.text.match(/^(Blizzard[\\/])([^\\/]+)(.*)$/i);if(!match||/^zones$/i.test(match[2]))continue;const replacement=Buffer.from(match[1]+target+match[3]),header=Buffer.alloc(12);header.writeUInt32LE(4);header.writeBigUInt64LE(BigInt(replacement.length),4);parts.push(raw.subarray(pos,record.offset),header,replacement);pos=record.offset+12+text.length;}parts.push(raw.subarray(pos));return Buffer.concat(parts);}

test('only checkpoint string records and their lengths change; working Zones and quest data are preserved',()=>{
  const records=[{offset:600,text:'Blizzard\\after_baron'},{offset:1000,text:'Blizzard\\after_baron\\UndeadRE01_02.w3z'},{offset:2000,text:'Blizzard\\Zones\\UndeadRE01.w3z'},{offset:3000,text:'Quest dialogue remains the same.'}];
  const source=repairSave(fixture(undefined,undefined,7000,{records}).data).data;
  const copy=source.slice(),result=migrateSavePaths(source,'after_baron_repaired_2');
  assert.deepEqual(source,copy);assert.equal(result.edits.length,2);assert.equal(result.verified,true);
  assert.deepEqual(logicalPayload(result.data),expectedPayload(source,records,'after_baron_repaired_2'));
  assert.deepEqual(result.data.subarray(48,64),source.subarray(48,64));assert.equal(inspectSave(result.data).status,'current');
});
for(const offset of [BLOCK-16,BLOCK-5])test(`string or length record crossing a block boundary at ${offset} is rebuilt correctly`,()=>{
  const records=[{offset,text:'Blizzard\\old\\UndeadRE01_03.w3z'}],source=fixture(undefined,undefined,7000,{records}).data;
  const result=migrateSavePaths(source,'old_repaired');assert.equal(result.edits.length,1);assert.deepEqual(logicalPayload(result.data),expectedPayload(source,records,'old_repaired'));
});
test('growth across the final block creates a padded block and updates payload size and block count',()=>{
  const records=[{offset:2*BLOCK-100,text:'Blizzard\\old'}],source=fixture(undefined,undefined,7000,{records}).data;
  const target='checkpoint_'+''.padEnd(120,'x')+'_repaired',result=migrateSavePaths(source,target);
  assert.equal(new DataView(result.data.buffer).getUint32(44,true),3);assert.deepEqual(logicalPayload(result.data),expectedPayload(source,records,target));assert.doesNotThrow(()=>inspectSave(result.data));
});
test('shrinking string records can remove a final block without losing gameplay data',()=>{
  const records=[{offset:600,text:'Blizzard\\'+''.padEnd(90,'a')}],source=fixture(undefined,undefined,7000,{records,payloadSize:BLOCK+10}).data;
  const result=migrateSavePaths(source,'r');assert.equal(new DataView(result.data.buffer).getUint32(44,true),1);assert.deepEqual(logicalPayload(result.data),expectedPayload(source,records,'r'));
});
test('UTF-8 byte lengths and forward-slash paths are handled without changing map checksums',()=>{
  const records=[{offset:600,text:'Blizzard/älter/UndeadRE01.w3z'}],source=fixture(undefined,undefined,7000,{records}).data;
  const result=migrateSavePaths(source,'Spiel_雪_repaired');assert.deepEqual(logicalPayload(result.data),expectedPayload(source,records,'Spiel_雪_repaired'));assert.equal(inspectSave(result.data).checksum,PROFILE.maps[0].old);
});
test('already matching paths are byte-identical; unknown map identities remain unchanged during path migration',()=>{
  const records=[{offset:600,text:'Blizzard\\save_repaired'}],source=fixture(undefined,undefined,7000,{records}).data;
  assert.deepEqual(migrateSavePaths(source,'save_repaired').data,source);
  const unknown=fixture({id:'undeadre01_05',old:'e3d412fe'},undefined,7003,{records}).data,result=migrateSavePaths(unknown,'another_repaired');
  assert.equal(inspectSave(result.data).status,'unsupported');assert.equal(inspectSave(result.data).checksum,'e3d412fe');
});
test('nonzero padding and unverified serialization formats stop migration',()=>{
  const source=fixture(undefined,undefined,7000,{records:[{offset:600,text:'Blizzard\\save'}],zeroPadding:false}).data;
  assert.throws(()=>migrateSavePaths(source,'save_repaired'),/padding/);
  const unknown=fixture({id:'undeadre01_05',old:'e3d412fe'},undefined,6999).data;
  assert.throws(()=>migrateSavePaths(unknown,'save_repaired'),/format/);
});
