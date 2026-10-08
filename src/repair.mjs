import {Inflate, Deflate, constants} from './vendor/pako.mjs';
import {PROFILE, mapProfile, unsupportedMapName} from './profiles.mjs';

const SIGNATURE=new TextEncoder().encode('Warcraft III recorded game\x1a\0');
const BLOCK_SIZE=1048576;
const table=Uint32Array.from({length:256},(_,i)=>{let c=i;for(let k=0;k<8;k++)c=(c&1)?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
export function crc32State(data,state=0xffffffff){let c=state;for(const byte of data)c=table[(c^byte)&255]^(c>>>8);return c>>>0;}
export function crc32(data){return (crc32State(data)^0xffffffff)>>>0;}
const fold=c=>(c^(c>>>16))&65535;
const check=(condition,message)=>{if(!condition)throw new Error(message);};
const view=data=>new DataView(data.buffer,data.byteOffset,data.byteLength);
const u32=(data,offset)=>view(data).getUint32(offset,true);
const u16=(data,offset)=>view(data).getUint16(offset,true);
const put32=(data,offset,value)=>view(data).setUint32(offset,value,true);
const hex=data=>Array.from(data,x=>x.toString(16).padStart(2,'0')).join('');
const unhex=value=>Uint8Array.from(value.match(/../g),x=>parseInt(x,16));
export const equal=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const join=arrays=>{const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){out.set(a,p);p+=a.length;}return out;};
export function headerCRC(header){const copy=header.slice();copy.fill(0,copy.length-4);return crc32(copy);}
export function blockCRC(data,expanded){const header=new Uint8Array(12);put32(header,0,data.length);put32(header,4,expanded);return (fold(crc32(header))|(fold(crc32(data))<<16))>>>0;}

export function inflateBlock(compressed,expected){
  const chunks=[];let length=0;
  const stream=new Inflate({chunkSize:65536,windowBits:15});
  stream.onData=chunk=>{length+=chunk.length;check(length<=expected,'A compressed block expands beyond its declared size.');chunks.push(chunk);};
  check(stream.push(compressed,false)&&!stream.err,`Invalid zlib block: ${stream.msg||'decompression failed'}`);
  if(!stream.ended&&stream.strm.next_out&&stream.strm.avail_out>0){
    const tail=stream.strm.output.slice(0,stream.strm.next_out);length+=tail.length;chunks.push(tail);
  }
  check(length===expected,'A compressed block has the wrong expanded size.');
  check(stream.strm.avail_in===0,'A compressed block contains unused bytes.');
  return join(chunks);
}
export function compressBlock(raw){
  const chunks=[];const stream=new Deflate({level:1});
  stream.onData=chunk=>chunks.push(chunk);
  check(stream.push(raw,constants.Z_SYNC_FLUSH)&&!stream.err,'Could not recompress the identity block.');
  return join(chunks);
}

export function decodeSettings(encoded){
  const decoded=[];let mask=0;
  for(let i=0;i<encoded.length;i++){
    if(i%8===0)mask=encoded[i];
    else decoded.push(mask&(1<<(i%8))?encoded[i]:encoded[i]-1);
  }
  return Uint8Array.from(decoded);
}
export function encodeSettings(decoded){
  const out=[];
  for(let p=0;p<decoded.length;p+=7){let mask=1;const group=Array.from(decoded.slice(p,p+7));for(let i=0;i<group.length;i++){if(group[i]&1)mask|=1<<(i+1);else group[i]++;}out.push(mask,...group);}
  return Uint8Array.from(out);
}
function zero(data,start,limit=data.length){for(let i=start;i<Math.min(data.length,limit);i++)if(data[i]===0)return i;throw new Error('A save identity string is not terminated.');}
function ascii(data){check(data.every(x=>x>=32&&x<127),'An identity string contains invalid characters.');return new TextDecoder().decode(data);}
const normalize=path=>path.toLowerCase().replaceAll('\\','/');
export function identity(raw){
  const map=ascii(raw.subarray(0,zero(raw,0,256)));
  const marker=new TextEncoder().encode('Local Game\0\0');let start=-1;
  for(let i=0;i<Math.min(raw.length-marker.length,256);i++)if(equal(raw.subarray(i,i+marker.length),marker)){start=i+marker.length;break;}
  check(start>=0,'The save settings record was not found.');
  const end=zero(raw,start,512);const encoded=raw.slice(start,end);const decoded=decodeSettings(encoded);
  check(decoded.length>=14&&equal(encodeSettings(decoded),encoded),'Unsupported settings encoding.');
  const embeddedMap=ascii(decoded.subarray(13,zero(decoded,13)));
  check(normalize(map)===normalize(embeddedMap),'The save contains inconsistent map identities.');
  const slotStart=end+9;
  check(slotStart+3<raw.length,'The slot record is missing.');
  const slotSize=u16(raw,slotStart);const slots=raw[slotStart+2];
  check(slots<=24&&slotSize===1+slots*9+6,'Unsupported player-slot layout.');
  const plainOffset=slotStart+2+slotSize+4;
  check(plainOffset+4<=raw.length,'The second map identity is missing.');
  const checksum=decoded.slice(9,13);
  check(equal(checksum,raw.subarray(plainOffset,plainOffset+4)),'The two map checksums disagree.');
  return {map,checksum:hex(checksum),decoded,settingsStart:start,settingsEnd:end,plainOffset};
}

export function inspectSave(input,{onBlock=()=>{}}={}){
  const data=input instanceof Uint8Array?input:new Uint8Array(input);
  check(data.length>=80&&equal(data.subarray(0,28),SIGNATURE),'This is not a supported Warcraft III save container.');
  check(u32(data,28)===68&&u32(data,36)===1,'Unsupported save container version.');
  check(u32(data,32)===data.length,'The save is truncated or its file size is incorrect.');
  check(u32(data,64)===headerCRC(data.subarray(0,68)),'The save header checksum is invalid.');
  const count=u32(data,44);const payloadSize=u32(data,40);
  check(count>0&&count<=2048,'The block count is outside the supported range.');
  check(payloadSize>(count-1)*BLOCK_SIZE&&payloadSize<=count*BLOCK_SIZE,'The save payload size is inconsistent.');
  let pos=68;let first;let firstEnd;let info;let supported;
  for(let index=0;index<count;index++){
    check(pos+12<=data.length,'A save block header is truncated.');
    const compressed=u32(data,pos);const expanded=u32(data,pos+4);const checksum=u32(data,pos+8);
    check(expanded===BLOCK_SIZE,'Unsupported expanded block size.');
    check(compressed>0&&pos+12+compressed<=data.length,'A save block is truncated.');
    const comp=data.subarray(pos+12,pos+12+compressed);
    check(blockCRC(comp,expanded)===checksum,`Block ${index+1} has an invalid checksum.`);
    if(index===0){
      first=inflateBlock(comp,expanded);info=identity(first);supported=mapProfile(info.map);firstEnd=pos+12+compressed;
    }else if(supported){inflateBlock(comp,expanded);}
    pos+=12+compressed;onBlock(index+1,count);
  }
  check(pos===data.length,'The save contains unexpected trailing data.');
  const build=u16(data,56);
  let status='unsupported';let reason='This map is not supported yet; this save will be copied unchanged.';
  const unsupportedName=unsupportedMapName(info.map);
  if(supported){
    check(u32(data,48)===PROFILE.gameIdentifier&&u32(data,52)===PROFILE.gameVersion,'This map uses an unverified save serialization format.');
    check(PROFILE.serializationBuilds.includes(build),'This save build is outside the tested repair profile.');
    if(info.checksum===supported.old){status='repair';reason='Old map checksum; ready to repair.';}
    else if(info.checksum===supported.current){status='current';reason='Map checksum already matches 3.0.1.';}
    else throw new Error('Unrecognized checksum for this Act One map. This may be a different patch; no repair will be guessed.');
  }
  return {map:info.map,mapId:supported?.id,mapName:supported?.name||unsupportedName||info.map.split(/[\\/]/).at(-1),
    checksum:info.checksum,targetChecksum:supported?.current,status,reason,build,blocks:count,
    first,firstEnd,info};
}

export function repairSave(input){
  const data=input instanceof Uint8Array?input:new Uint8Array(input);
  const inspection=inspectSave(data);
  if(inspection.status!=='repair')return {data,inspection,changedOffsets:[]};
  const old=inspection.first;const raw=old.slice();const info=inspection.info;
  const decoded=info.decoded.slice();const checksum=unhex(inspection.targetChecksum);
  decoded.set(checksum,9);const encoded=encodeSettings(decoded);
  check(encoded.length===info.settingsEnd-info.settingsStart,'The encoded settings length changed.');
  raw.set(encoded,info.settingsStart);raw.set(checksum,info.plainOffset);
  const allowed=new Set();for(let i=info.plainOffset;i<info.plainOffset+4;i++)allowed.add(i);
  for(let i=9;i<13;i++){allowed.add(info.settingsStart+8*Math.floor(i/7));allowed.add(info.settingsStart+8*Math.floor(i/7)+1+i%7);}
  const changedOffsets=[];for(let i=0;i<raw.length;i++)if(old[i]!==raw[i]){check(allowed.has(i),'A gameplay byte would change; repair stopped.');changedOffsets.push(i);}
  const comp=compressBlock(raw);check(equal(inflateBlock(comp,raw.length),raw),'Recompressed identity block did not round-trip.');
  check(identity(raw).checksum===inspection.targetChecksum,'Output map identity verification failed.');
  const blockHeader=new Uint8Array(12);put32(blockHeader,0,comp.length);put32(blockHeader,4,raw.length);put32(blockHeader,8,blockCRC(comp,raw.length));
  const header=data.slice(0,68);const total=68+12+comp.length+data.length-inspection.firstEnd;
  put32(header,32,total);put32(header,64,headerCRC(header));
  const repaired=join([header,blockHeader,comp,data.subarray(inspection.firstEnd)]);
  check(equal(repaired.subarray(48,64),data.subarray(48,64)),'Save build or duration changed.');
  check(equal(repaired.subarray(80+comp.length),data.subarray(inspection.firstEnd)),'An untouched compressed block changed.');
  check(u32(repaired,64)===headerCRC(repaired.subarray(0,68))&&u32(repaired,32)===repaired.length,'Output container verification failed.');
  return {data:repaired,inspection,changedOffsets};
}

export function safePath(input){
  check(typeof input==='string'&&input.length>0&&input.length<=1024,'Invalid bundle filename.');
  const name=input.replaceAll('\\','/');
  check(!name.startsWith('/')&&!/[\x00-\x1f\x7f:]/.test(name),'Unsafe bundle path.');
  const parts=name.split('/');
  check(parts.every(part=>part&&part!=='.'&&part!=='..'&&!/[. ]$/.test(part)),'Unsafe bundle path.');
  check(parts.every(part=>!/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(part)),'Unsupported Windows reserved filename.');
  return name;
}
export function assertUniquePaths(entries){const names=new Set();for(const entry of entries){const name=safePath(entry.path);const key=name.toLowerCase();check(!names.has(key),`Duplicate bundle path: ${name}`);names.add(key);}}
