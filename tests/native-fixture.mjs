import {deflateSync,constants} from 'node:zlib';
import {fixture} from './save-fixture.mjs';
import {PROFILE} from '../dist/profiles.mjs';
import {inspectSave,repairSave,inflateBlock,headerCRC,blockCRC} from '../dist/repair.mjs';
const encoder=new TextEncoder(),map=PROFILE.maps.find(m=>m.id==='undeadre02_06');
const put=(bytes,pos,value)=>new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength).setUint32(pos,value,true);
const join=arrays=>new Uint8Array(Buffer.concat(arrays));
function chunk(body){const header=new Uint8Array(8);header.set(encoder.encode('espi'));put(header,4,body.length);return join([header,body]);}
export function nativeFixture({current=false,checksum='b0669dc1',build=7000,deleted=false,badField=false,companionPath=null}={}){
  const initial=fixture(map,checksum,build).data,old=inspectSave(initial);
  const raw=new Uint8Array(2097152);raw.set(old.first.subarray(0,512));
  if(companionPath){const text=encoder.encode(companionPath),record=new Uint8Array(12+text.length);put(record,0,4);new DataView(record.buffer).setBigUint64(4,BigInt(text.length),true);record.set(text,12);raw.set(record,2048);}
  const allocation=new Uint8Array(36);put(allocation,0,2);allocation.set(encoder.encode('lga+bdUM'),20);put(allocation,28,17);put(allocation,32,42);
  const first=new Uint8Array(160);put(first,36,17);put(first,40,42);put(first,76,17);put(first,80,42);
  const state=new Uint8Array((deleted?321:341)+(current?4:0));put(state,100,0x18006);
  if(current){state.set(encoder.encode('bdUB'),104);put(state,140,0x18006);}
  if(badField)put(state,104,123);
  put(state,current?152:148,17);put(state,current?156:152,42);
  state.set(encoder.encode('Abilities\\Weapons\\Arrow\\ArrowMissile.mdl\0'),current?185:181);
  const second=join([new Uint8Array(8),chunk(state),chunk(new Uint8Array())]);
  const length=new Uint8Array(4);put(length,0,second.length);
  const lua=Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8,0,0,0,0]),wrapper=new Uint8Array(16);put(wrapper,4,2);put(wrapper,8,lua.length+16);put(wrapper,12,lua.length);
  raw.set(join([chunk(allocation),chunk(first),chunk(encoder.encode('espi')),length,second,wrapper,lua]),1048000);
  const meaningful=2097152-37+(current?4:0),blocks=[];
  for(let offset=0;offset<raw.length;offset+=1048576){const bytes=raw.subarray(offset,offset+1048576),compressed=deflateSync(bytes,{level:1,finishFlush:constants.Z_SYNC_FLUSH}),header=new Uint8Array(12);put(header,0,compressed.length);put(header,4,bytes.length);put(header,8,blockCRC(compressed,bytes.length));blocks.push(header,compressed);}
  const body=join(blocks),header=initial.slice(0,68);put(header,32,68+body.length);put(header,40,meaningful);put(header,64,headerCRC(header));
  return join([header,body]);
}
export function expanded(data){const v=new DataView(data.buffer,data.byteOffset,data.byteLength),parts=[];for(let i=0,pos=68;i<v.getUint32(44,true);i++){const size=v.getUint32(pos,true);parts.push(inflateBlock(data.subarray(pos+12,pos+12+size),1048576));pos+=12+size;}return join(parts);}
