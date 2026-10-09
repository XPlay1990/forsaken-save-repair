// Synthetic native saves with the observed 3.0.1 (build 7003) or 3.0.0 (build 7000) structure.
// Contains no game data: object types, offsets and lengths mirror the private Scarlet references.
import {deflateSync,constants} from 'node:zlib';
import {fixture} from './save-fixture.mjs';
import {PROFILE,DOWNGRADE_PROFILE} from '../dist/profiles.mjs';
import {inspectSave,blockCRC,headerCRC} from '../dist/repair.mjs';
import {API_ALIASES,API_REMOVED} from '../dist/native-downgrade.mjs';
const encoder=new TextEncoder(),BLOCK=1048576;
const scarlet=PROFILE.maps.find(map=>map.id==='undeadre02_06');
class Writer{
  constructor(){this.parts=[];this.length=0;}
  bytes(value){this.parts.push(value);this.length+=value.length;return this;}
  u8(value){return this.bytes(Uint8Array.of(value));}
  u32(value){const b=new Uint8Array(4);new DataView(b.buffer).setUint32(0,value>>>0,true);return this.bytes(b);}
  u64(value){return this.u32(value).u32(0);}
  text(value){return this.bytes(encoder.encode(value));}
  done(){return new Uint8Array(Buffer.concat(this.parts));}
}
const record=body=>new Writer().text('espi').u32(body.length).bytes(body).done();

// Symbolic Lua graph; a node met again is written as an Eris reference automatically.
const str=value=>({t:'string',value}),table=pairs=>({t:'table',pairs}),perm=child=>({t:'perm',child});
function eris(root){
  const w=new Writer().bytes(Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8])),seen=new Map();
  const value=node=>{
    if(node===null)return w.u32(0);
    if(seen.has(node))return w.u32(seen.get(node)+14);
    seen.set(node,seen.size+1);
    if(node.t==='string'){const b=encoder.encode(node.value);return w.u32(4).u64(b.length).bytes(b);}
    if(node.t==='perm'){w.u32(13).u8(6);return value(node.child);}
    if(node.t==='table'){w.u32(5).u8(0).u32(0);for(const [k,v] of node.pairs){value(k);value(v);}w.u32(0);return w.u32(0);}
    if(node.t==='closure'){
      w.u32(6).u8(0).u8(0).u32(9).u32(1).u32(2).bytes(Uint8Array.of(0,0,2)).u32(1).u32(0x00800026).u32(node.constants.length);
      seen.set({},seen.size+1); // the prototype is a referenceable object of its own
      for(const c of node.constants)value(c);
      return w.u32(0).u32(0).u8(0);
    }
    if(node.t==='thread'){
      // One suspended frame and no open upvalues; the opaque header carries the wait ID.
      w.u32(8).u32(0x1c464800).u32(node.wait).u32(0).u8(1).u32(40).u64(1);value(null);
      w.u8(1).u64(0).u64(0).u64(1).bytes(Uint8Array.of(0,0)).u8(0).u8(1);
      return w.u64(0).u64(0);
    }
    throw Error('unknown fixture node');
  };
  value(root);return w.done();
}
function luaGraph({legacy,waits,scriptUses}){
  // 3.0.0 functions that script fallbacks bind to, as in the real map scripts.
  const destroyEffect=str('DestroyEffect'),globals=[[destroyEffect,perm(destroyEffect)],[str('DoNothing'),{t:'closure',constants:[]}]];
  if(!legacy)for(const name of API_REMOVED){const key=str(name);globals.push([key,perm(key)]);}
  const aliases=Object.entries(API_ALIASES).map(([current,old])=>str(legacy?old:current));
  for(const key of aliases)globals.push([key,perm(key)]);
  // Later objects reference earlier ones, so removing definitions must renumber them.
  const shared=str('Trig_Scarlet_Inquisitors');
  globals.push([shared,{t:'closure',constants:[str('toString'),aliases[3],shared]}]);
  if(scriptUses)globals.push([str('captured'),{t:'closure',constants:[scriptUses].flat().map(name=>globals.find(([k])=>k.value===name)[0])}]);
  for(const wait of waits)globals.push([str(`waiter${wait}`),{t:'thread',wait}]);
  return table([[str('_LOADED'),table([[str('_G'),table(globals)]])]]);
}
// 3.0.1 projectiles insert 0x18006 at 140 (model path 181 -> 185) and carry buff BUdb at 104.
function missile(model,legacy,id){
  const path=encoder.encode(model+'\0'),at=legacy?181:185,body=new Uint8Array(at+path.length+120);
  for(let i=0;i<body.length;i++)body[i]=(i*11+3)%241||2;
  const v=new DataView(body.buffer);v.setUint32(100,0x18006,true);
  // After the field 3.0.1 inserts at 140, both layouts continue with a zero dword.
  if(legacy){v.setUint32(104,0,true);v.setUint32(140,0,true);}else{body.set(encoder.encode('bdUB'),104);v.setUint32(140,0x18006,true);v.setUint32(144,0,true);}
  body.fill(9,legacy?144:148,at-1);body[at-1]=1;body.set(path,at);
  // The tail after the path is identical in both layouts.
  for(let i=0;i<120;i++)body[at+path.length+i]=(i*5+1)%199||1;
  new DataView(body.buffer).setUint32(at+path.length+8,id[0],true);new DataView(body.buffer).setUint32(at+path.length+12,id[1],true);
  return body;
}
function native({legacy,waits,scriptUses,missiles=[]}){
  const objects=[['lga+u3w+',[1,2]],['lga+tset',[3,4]],...missiles.map((_,i)=>['lga+bdUM',[20+i,30+i]]),['fda^fda^',[5,6]]];
  const allocation=new Writer().text('espi').u32(4+16*objects.length).u32(objects.length);
  for(const [type,[a,b]] of objects)allocation.text(type).u32(a).u32(b);
  const aux=new Writer().u32(4+16*3).u32(3).text('fda^fda^').u32(9).u32(9).text('lga+mac+').u32(10).u32(10).text('lga+ksat').u32(11).u32(11).done();
  const ctor=(a,b)=>{const body=new Uint8Array(160);const v=new DataView(body.buffer);v.setUint32(36,a,true);v.setUint32(40,b,true);v.setUint32(76,a,true);v.setUint32(80,b,true);return body;};
  const unit=new Uint8Array(legacy?680:700);for(let i=0;i<680;i++)unit[i]=(i*7+1)%251||1;
  // 3.0.1 inserts a zero dword 665 bytes before the end; the (non-zero) bytes after it keep their values.
  if(!legacy){unit.copyWithin(39,35,680);unit.fill(0,35,39);unit.set([255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0],684);}
  const camera=new Uint8Array(legacy?941:945).fill(3);if(!legacy)camera.set([1,0,0,0],304);
  const root=(leaves,trailer)=>new Writer().u32(8).text('rootHead').bytes(Buffer.concat(leaves.map(record))).bytes(trailer).done();
  const auxCtor=root([new Uint8Array(40).fill(4),new Uint8Array(40).fill(5)],encoder.encode('espi'));
  const auxState=root([camera,new Uint8Array(24).fill(6)],new Uint8Array(4));
  const first=[record(ctor(1,2)),record(ctor(3,4)),...missiles.map((_,i)=>record(ctor(20+i,30+i))),record(auxCtor)];
  const second=[record(unit),record(new Uint8Array(48).fill(8)),...missiles.map((model,i)=>record(missile(model,legacy,[20+i,30+i]))),record(auxState)];
  const head=allocation.done(),early=new Uint8Array(1024);
  early.set(aux);
  const firstBytes=Buffer.concat(first),parent=early.length-376,gap=new Uint8Array(32);
  new DataView(early.buffer).setUint32(parent,376+firstBytes.length-first.at(-1).length,true);
  new DataView(early.buffer).setUint32(parent+4,368,true);
  const secondBytes=Buffer.concat(second),toLast=4+gap.length+secondBytes.length-second.at(-1).length;
  const lua=eris(luaGraph({legacy,waits,scriptUses})),header=new Writer().bytes(Uint8Array.of(0x8e,0x31,0x46,0x1c)).u32(lua.length+28+4*waits.length).u32(waits.length).u32(0);
  for(const wait of waits)header.u32(wait);
  header.u32(lua.length+16).u32(lua.length);
  return Buffer.concat([head,early,firstBytes,new Writer().u32(toLast).done(),gap,secondBytes,header.done(),lua,new Uint8Array(12),encoder.encode('8f31461c-tail')]);
}
export function native301Fixture({map=scarlet,legacy=false,waits=[2],scriptUses=null,missiles=[],checksum,build}={}){
  const profileMap=DOWNGRADE_PROFILE.maps.find(row=>row.id===map.id);
  const sum=checksum??(legacy?profileMap.current:profileMap.old),initial=fixture(map,sum,build??(legacy?7000:7003)).data;
  const identity=inspectSave(initial,{profile:PROFILE}).first,body=native({legacy,waits,scriptUses,missiles});
  const meaningful=4096+body.length,raw=new Uint8Array(Math.ceil(meaningful/BLOCK)*BLOCK);
  raw.set(identity.subarray(0,512));raw.set(body,4096);
  const blocks=[];
  for(let offset=0;offset<raw.length;offset+=BLOCK){
    const bytes=raw.subarray(offset,offset+BLOCK),compressed=deflateSync(bytes,{level:1,finishFlush:constants.Z_SYNC_FLUSH}),h=new Uint8Array(12),v=new DataView(h.buffer);
    v.setUint32(0,compressed.length,true);v.setUint32(4,BLOCK,true);v.setUint32(8,blockCRC(compressed,BLOCK),true);blocks.push(h,compressed);
  }
  const data=Buffer.concat(blocks),out=new Uint8Array(68+data.length);out.set(initial.subarray(0,68));out.set(data,68);
  const v=new DataView(out.buffer);v.setUint32(32,out.length,true);v.setUint32(40,meaningful,true);v.setUint32(44,raw.length/BLOCK,true);v.setUint32(64,headerCRC(out.subarray(0,68)),true);
  return out;
}
