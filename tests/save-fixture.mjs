import {deflateSync,constants as z} from 'node:zlib';
import {PROFILE} from '../dist/profiles.mjs';
import {headerCRC,blockCRC,encodeSettings} from '../dist/repair.mjs';
const write=(data,pos,value)=>new DataView(data.buffer,data.byteOffset,data.byteLength).setUint32(pos,value,true);
const bytes=hex=>Uint8Array.from(hex.match(/../g),x=>parseInt(x,16));
export function fixture(map=PROFILE.maps[0],checksum=map.old||'11223344',build=7000,{records=[],payloadSize=2097152-37,zeroPadding=true,assetFlag}={}){
  const mapPath=map.path||`Campaign\\ForsakenKingdom\\${map.id}.w3xd`;
  const raw=new Uint8Array(1048576);for(let i=512;i<raw.length;i++)raw[i]=(i*13+i%19)&255;
  const prefix=new TextEncoder().encode(`${mapPath}\0\0UndeadRe\0\0\0\0\0Local Game\0\0`);
  raw.set(prefix);
  const decoded=new Uint8Array(13+mapPath.length+1+8);
  decoded.set([2,0,0,0,4,102,1,118,1]);decoded.set(bytes(checksum),9);decoded.set(new TextEncoder().encode(mapPath),13);
  const encoded=encodeSettings(decoded);raw.set(encoded,prefix.length);
  const end=prefix.length+encoded.length;const slot=end+9;
  new DataView(raw.buffer).setUint16(slot,16,true);raw[slot+2]=1;
  write(raw,slot+2+16,0x45671234);raw.set(bytes(checksum),slot+2+16+4);
  // Player header record: 01 00 00 00, name, NUL, u32 flag (4 after a fresh start, 0 after a 3.0.0 reload).
  if(assetFlag!==undefined){const at=slot+2+16+4+4+24;write(raw,at,1);raw.set(new TextEncoder().encode('Tester#1\0'),at+4);write(raw,at+13,assetFlag);}
  const second=new Uint8Array(1048576);for(let i=0;i<second.length;i++)second[i]=(i*7+i%11)&255;
  const payload=new Uint8Array(2097152);payload.set(raw);payload.set(second,1048576);
  if(zeroPadding)payload.fill(0,payloadSize);
  for(const record of records){const text=new TextEncoder().encode(record.text),serialized=new Uint8Array(12+text.length);write(serialized,0,4);new DataView(serialized.buffer).setBigUint64(4,BigInt(text.length),true);serialized.set(text,12);if(record.offset+serialized.length>payloadSize)throw Error('Fixture record exceeds payload');payload.set(serialized,record.offset);}
  const expanded=[payload.subarray(0,1048576),payload.subarray(1048576)];const blocks=expanded.map(raw=>{const comp=deflateSync(raw,{level:1,finishFlush:z.Z_SYNC_FLUSH});const head=new Uint8Array(12);write(head,0,comp.length);write(head,4,raw.length);write(head,8,blockCRC(comp,raw.length));return Buffer.concat([head,comp]);});
  const header=new Uint8Array(68);header.set(new TextEncoder().encode('Warcraft III recorded game\x1a\0'));write(header,28,68);write(header,32,68+blocks.reduce((n,b)=>n+b.length,0));write(header,36,1);write(header,40,payloadSize);write(header,44,expanded.length);write(header,48,PROFILE.gameIdentifier);write(header,52,PROFILE.gameVersion);new DataView(header.buffer).setUint16(56,build,true);write(header,60,12345);write(header,64,headerCRC(header));
  return {data:new Uint8Array(Buffer.concat([header,...blocks])),raw:expanded[0],blocks};
}
