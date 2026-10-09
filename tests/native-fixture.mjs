import {deflateSync,constants} from 'node:zlib';
import {fixture} from './save-fixture.mjs';
import {PROFILE} from '../dist/profiles.mjs';
import {inspectSave,repairSave,inflateBlock,headerCRC,blockCRC} from '../dist/repair.mjs';
const encoder=new TextEncoder(),scarlet=PROFILE.maps.find(m=>m.id==='undeadre02_06');
const put=(bytes,pos,value)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(pos,value,true);
const join=arrays=>new Uint8Array(Buffer.concat(arrays));
function chunk(body){const header=new Uint8Array(8);header.set(encoder.encode('espi'));put(header,4,body.length);return join([header,body]);}
export function nativeFixture({map=scarlet,current=false,checksum=map.old||'11223344',build=7000,deleted=false,badField=false,companionPath=null,allocationOffset=1048000,decoys=false,type='lga+bdUM',ambiguous=false,markerText=false}={}){
  const initial=fixture(map,checksum,build).data,old=inspectSave(initial);
  const raw=new Uint8Array(2097152);raw.set(old.first.subarray(0,512));
  if(decoys){raw.set(encoder.encode('description: espi is just text'),4096);raw.set(chunk(new Uint8Array([1,0,0,0,...new Uint8Array(16)])),8192);}
  const allocation=new Uint8Array(36);put(allocation,0,2);allocation.set(encoder.encode(type),20);put(allocation,28,17);put(allocation,32,42);
  if(ambiguous)raw.set(chunk(allocation),16384);
  if(markerText)raw.set(encoder.encode('A string mentioning lga+bdUM is not an allocation entry.'),32768);
  const first=new Uint8Array(160);put(first,36,17);put(first,40,42);put(first,76,17);put(first,80,42);
  const state=new Uint8Array((deleted?321:341)+(current?4:0));put(state,100,0x18006);
  if(current){state.set(encoder.encode('bdUB'),104);put(state,140,0x18006);}
  if(badField)put(state,104,123);
  put(state,current?152:148,17);put(state,current?156:152,42);
  state.set(encoder.encode('Abilities\\Weapons\\Arrow\\ArrowMissile.mdl\0'),current?185:181);
  const second=join([new Uint8Array(8),chunk(state),chunk(new Uint8Array())]);
  const length=new Uint8Array(4);put(length,0,second.length);
  // Saved Lua: like real saves, the campaign script's companion folder is a Lua string (udg_SaveFolder).
  const str=value=>{const bytes=encoder.encode(value),record=new Uint8Array(12+bytes.length);put(record,0,4);put(record,4,bytes.length);record.set(bytes,12);return record;};
  const int=value=>{const bytes=new Uint8Array(4);put(bytes,0,value);return bytes;};
  const paths=[companionPath].flat().filter(Boolean);
  const graph=paths.length?join([int(5),Uint8Array.of(0),int(0),...paths.flatMap((path,i)=>[str(`udg_SavePath${i}`),str(path)]),int(0),int(0)]):int(0);
  const lua=join([Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8]),graph]),wrapper=new Uint8Array(24);
  wrapper.set([0x8e,0x31,0x46,0x1c]);put(wrapper,4,lua.length+28);put(wrapper,16,lua.length+16);put(wrapper,20,lua.length);
  raw.set(join([chunk(allocation),chunk(first),chunk(encoder.encode('espi')),length,second,wrapper,lua]),allocationOffset);
  const meaningful=2097152-37+(current?4:0),blocks=[];
  for(let offset=0;offset<raw.length;offset+=1048576){const bytes=raw.subarray(offset,offset+1048576),compressed=deflateSync(bytes,{level:1,finishFlush:constants.Z_SYNC_FLUSH}),header=new Uint8Array(12);put(header,0,compressed.length);put(header,4,bytes.length);put(header,8,blockCRC(compressed,bytes.length));blocks.push(header,compressed);}
  const body=join(blocks),header=initial.slice(0,68);put(header,32,68+body.length);put(header,40,meaningful);put(header,64,headerCRC(header));
  return join([header,body]);
}
export function expanded(data){const v=new DataView(data.buffer,data.byteOffset,data.byteLength),parts=[];for(let i=0,pos=68;i<v.getUint32(44,true);i++){const size=v.getUint32(pos,true);parts.push(inflateBlock(data.subarray(pos+12,pos+12+size),1048576));pos+=12+size;}return join(parts);}
