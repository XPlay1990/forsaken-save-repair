import {Inflate, Deflate, constants} from './vendor/pako.mjs';
import {PROFILE, mapProfile, unsupportedMapName} from './profiles.mjs';
import {mapByPath} from './map-versions.mjs';
import {projectilePlan,applyProjectilePlan,projectileScanner} from './projectiles.mjs';
import {downgradeNativePayload} from './native-downgrade.mjs';
import {renameStoredFolders} from './save-rename.mjs';

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
  check(stream.push(raw,constants.Z_SYNC_FLUSH)&&!stream.err,'Could not recompress a save block.');
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

export function inspectSave(input,{profile=PROFILE,onBlock=()=>{},onExpandedBlock=()=>{}}={}){
  const data=input instanceof Uint8Array?input:new Uint8Array(input);
  check(data.length>=80&&equal(data.subarray(0,28),SIGNATURE),'This is not a supported Warcraft III save container.');
  check(u32(data,28)===68&&u32(data,36)===1,'Unsupported save container version.');
  check(u32(data,32)===data.length,'The save is truncated or its file size is incorrect.');
  check(u32(data,64)===headerCRC(data.subarray(0,68)),'The save header checksum is invalid.');
  const count=u32(data,44);const payloadSize=u32(data,40);
  check(count>0&&count<=2048,'The block count is outside the supported range.');
  check(payloadSize>(count-1)*BLOCK_SIZE&&payloadSize<=count*BLOCK_SIZE,'The save payload size is inconsistent.');
  const build=u16(data,56),projectiles=projectileScanner(),nativeBuild=!!profile.nativeBuilds?.includes(build);
  let pos=68;let first;let firstEnd;let info;let supported;let collectProjectiles=false;
  for(let index=0;index<count;index++){
    check(pos+12<=data.length,'A save block header is truncated.');
    const compressed=u32(data,pos);const expanded=u32(data,pos+4);const checksum=u32(data,pos+8);
    check(expanded===BLOCK_SIZE,'Unsupported expanded block size.');
    check(compressed>0&&pos+12+compressed<=data.length,'A save block is truncated.');
    const comp=data.subarray(pos+12,pos+12+compressed);
    check(blockCRC(comp,expanded)===checksum,`Block ${index+1} has an invalid checksum.`);
    if(index===0){
      first=inflateBlock(comp,expanded);info=identity(first);supported=mapProfile(info.map,profile);firstEnd=pos+12+compressed;
      collectProjectiles=!!supported&&profile.serializationBuilds.includes(build)&&!nativeBuild;
      if(collectProjectiles)projectiles.scan(first);
      onExpandedBlock(first,index);
    }else if(supported){const raw=inflateBlock(comp,expanded);if(collectProjectiles)projectiles.scan(raw);onExpandedBlock(raw,index);}
    pos+=12+compressed;onBlock(index+1,count);
  }
  check(pos===data.length,'The save contains unexpected trailing data.');
  const details={map:info.map,mapId:supported?.id||info.map.split(/[\\/]/).at(-1).replace(/\.w3xd$/i,'').toLowerCase(),
    mapName:supported?.name||unsupportedMapName(info.map)||info.map.split(/[\\/]/).at(-1),
    mapNameSource:supported?'repair-profile':mapByPath(info.map)?.nameSource||'map-filename',
    checksum:info.checksum,targetChecksum:supported?.current||mapByPath(info.map)?.checksums[profile.to],
    sourceRevisionKnown:supported?info.checksum===supported.old||info.checksum===supported.current:null,
    mapGameTested:supported?.gameTested??null,build,blocks:count,
    gameIdentifier:u32(data,48),gameVersion:u32(data,52)};
  let status='unsupported';let reason='This map is not supported yet; this save will be copied unchanged.';let nativePlan=null,nativePayload=null,nativeConversion=null;
  try{
    if(supported){
      check(u32(data,48)===profile.gameIdentifier&&u32(data,52)===profile.gameVersion,'This map uses an unverified save serialization format.');
      check(profile.serializationBuilds.includes(build)||nativeBuild,'This save build is outside the tested repair profile.');
      if(profile.strictSource)check(details.sourceRevisionKnown,'Downgrade stopped: unverified source map revision.');
      if(nativeBuild){
        check(info.checksum===supported.old,'Downgrade stopped: a save written by Warcraft III 3.0.1 must use the 3.0.1 map checksum.');
        const payload=new Uint8Array(count*BLOCK_SIZE);payload.set(first);
        for(let index=1,offset=firstEnd;index<count;index++){
          const size=u32(data,offset);payload.set(inflateBlock(data.subarray(offset+12,offset+12+size),BLOCK_SIZE),index*BLOCK_SIZE);offset+=12+size;
        }
        check(payload.subarray(payloadSize).every(byte=>byte===0),'Downgrade stopped: unverified payload padding.');
        nativeConversion=downgradeNativePayload(payload.subarray(0,payloadSize));
        const r=nativeConversion.report,shots=r.projectilesReversed;
        status='repair';reason=`Saved by Warcraft III 3.0.1: ready to convert ${r.units} units${shots?`, ${shots} projectile${shots===1?'':'s'}`:''}, saved script natives, the camera state and the map checksum to 3.0.0.`+
          (r.scriptFallbacks.length?` Scripts from the 3.0.1 map use 3.0.1-only functions, replaced with 3.0.0 behaviour (not yet tested in game): ${r.scriptFallbacks.map(f=>`${f.native} → ${f.replacement} (${f.effect})`).join('; ')}.`:'');
      }
      if(collectProjectiles&&projectiles.found){
        nativePayload=new Uint8Array(count*BLOCK_SIZE);nativePayload.set(first);
        for(let index=1,offset=firstEnd;index<count;index++){
          const size=u32(data,offset);nativePayload.set(inflateBlock(data.subarray(offset+12,offset+12+size),BLOCK_SIZE),index*BLOCK_SIZE);offset+=12+size;
        }
        nativePlan=projectilePlan(nativePayload,{...details,payloadSize,direction:profile.direction});
        if(!nativePlan)nativePayload=null;
      }
      if(nativeConversion){}
      else if(info.checksum===supported.current){status='current';reason=`Map checksum already matches ${profile.to}.`;}
      else {status='repair';reason=`Map checksum differs from ${profile.to}; ready for checksum repair.`;}
      if(nativePlan){status='repair';reason=`Ready to ${profile.direction==='downgrade'?'downgrade':'repair'} ${nativePlan.records} Deathseeker projectile record${nativePlan.records===1?'':'s'}${info.checksum!==supported.current?' and the map checksum':''}.`;}
    }
  }catch(error){error.inspection={...details,status:'blocked',reason:error.message};throw error;}
  return {...details,status,reason,first,firstEnd,info,projectileRepairCount:nativeConversion?.report.projectilesReversed||nativePlan?.records||0,
    nativeDowngrade:nativeConversion?.report||null,nativeConversion,nativePlan,nativePayload};
}

export function repairSave(input,{profile=PROFILE}={}){
  const data=input instanceof Uint8Array?input:new Uint8Array(input);
  const inspection=inspectSave(data,{profile});
  if(inspection.status!=='repair')return {data,inspection,changedOffsets:[]};
  if(inspection.nativeConversion)return nativeDowngrade(data,inspection,profile);
  const old=inspection.first;const raw=old.slice();const info=inspection.info;
  const decoded=info.decoded.slice();const checksum=unhex(inspection.targetChecksum);
  decoded.set(checksum,9);const encoded=encodeSettings(decoded);
  check(encoded.length===info.settingsEnd-info.settingsStart,'The encoded settings length changed.');
  raw.set(encoded,info.settingsStart);raw.set(checksum,info.plainOffset);
  const allowed=new Set();for(let i=info.plainOffset;i<info.plainOffset+4;i++)allowed.add(i);
  for(let i=9;i<13;i++){allowed.add(info.settingsStart+8*Math.floor(i/7));allowed.add(info.settingsStart+8*Math.floor(i/7)+1+i%7);}
  const changedOffsets=[];for(let i=0;i<raw.length;i++)if(old[i]!==raw[i]){check(allowed.has(i),'A gameplay byte would change; repair stopped.');changedOffsets.push(i);}
  if(inspection.nativePlan){
    const originalPayload=inspection.nativePayload;
    const converted=applyProjectilePlan(originalPayload,inspection.nativePlan,u32(data,40));
    for(const offset of changedOffsets)converted.raw[offset]=raw[offset];
    const parts=[];let pos=68;
    for(let index=0;index<converted.raw.length/BLOCK_SIZE;index++){
      const chunk=converted.raw.subarray(index*BLOCK_SIZE,(index+1)*BLOCK_SIZE);
      const unchanged=equal(chunk,originalPayload.subarray(index*BLOCK_SIZE,(index+1)*BLOCK_SIZE));
      if(unchanged&&index<u32(data,44)){const length=u32(data,pos);parts.push(data.subarray(pos,pos+12+length));}
      else {const compressed=compressBlock(chunk);check(equal(inflateBlock(compressed,BLOCK_SIZE),chunk),'Converted state block failed round-trip.');const header=new Uint8Array(12);put32(header,0,compressed.length);put32(header,4,BLOCK_SIZE);put32(header,8,blockCRC(compressed,BLOCK_SIZE));parts.push(header,compressed);}
      if(index<u32(data,44))pos+=12+u32(data,pos);
    }
    const body=join(parts),header=data.slice(0,68);put32(header,32,68+body.length);put32(header,40,converted.payloadSize);put32(header,44,converted.raw.length/BLOCK_SIZE);put32(header,64,headerCRC(header));
    const repaired=join([header,body]);
    const verified=inspectSave(repaired,{profile});
    check(verified.status==='current'&&verified.projectileRepairCount===0&&verified.checksum===inspection.targetChecksum,'Converted output verification failed.');
    check(equal(repaired.subarray(48,64),data.subarray(48,64)),'Save build or duration changed.');
    return {data:repaired,inspection,changedOffsets,projectileRepairs:inspection.projectileRepairCount};
  }
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

// Native 3.0.1 save -> 3.0.0: converted payload, restored map checksum, build 7000, every block recompressed.
// Recompress a full meaningful payload into a container, keeping the original header except sizes/build.
function repack(data,raw,build){
  const payloadSize=raw.length,blocks=Math.ceil(payloadSize/BLOCK_SIZE),parts=[];
  for(let index=0;index<blocks;index++){
    const chunk=new Uint8Array(BLOCK_SIZE);chunk.set(raw.subarray(index*BLOCK_SIZE,Math.min(payloadSize,(index+1)*BLOCK_SIZE)));
    const compressed=compressBlock(chunk);check(equal(inflateBlock(compressed,BLOCK_SIZE),chunk),'A rewritten state block failed round-trip.');
    const header=new Uint8Array(12);put32(header,0,compressed.length);put32(header,4,BLOCK_SIZE);put32(header,8,blockCRC(compressed,BLOCK_SIZE));parts.push(header,compressed);
  }
  const body=join(parts),header=data.slice(0,68);
  view(header).setUint16(56,build,true);put32(header,32,68+body.length);put32(header,40,payloadSize);put32(header,44,blocks);put32(header,64,headerCRC(header));
  return join([header,body]);
}
function payloadOf(data){
  const count=u32(data,44),size=u32(data,40),raw=new Uint8Array(count*BLOCK_SIZE);
  for(let index=0,offset=68;index<count;index++){const length=u32(data,offset);raw.set(inflateBlock(data.subarray(offset+12,offset+12+length),BLOCK_SIZE),index*BLOCK_SIZE);offset+=12+length;}
  check(raw.subarray(size).every(byte=>byte===0),'Unverified payload padding.');
  return raw.subarray(0,size);
}
// Rewrite the companion folder paths the campaign script stored in this save (see save-rename.mjs).
export function renameSave(input,folders,{profile=PROFILE}={}){
  const data=input instanceof Uint8Array?input:new Uint8Array(input),before=inspectSave(data,{profile});
  const result=renameStoredFolders(payloadOf(data),folders);
  if(!result.renamed.length)return {data,renamed:[]};
  const output=repack(data,result.raw,u16(data,56)),after=inspectSave(output,{profile});
  check(after.checksum===before.checksum&&after.status===before.status&&equal(output.subarray(48,64),data.subarray(48,64)),'Renamed output verification failed.');
  return {data:output,renamed:result.renamed};
}

function nativeDowngrade(data,inspection,profile){
  const raw=inspection.nativeConversion.raw,payloadSize=raw.length;
  const info=identity(raw.subarray(0,BLOCK_SIZE)),decoded=info.decoded.slice(),checksum=unhex(inspection.targetChecksum);
  decoded.set(checksum,9);const encoded=encodeSettings(decoded);
  check(encoded.length===info.settingsEnd-info.settingsStart,'The encoded settings length changed.');
  raw.set(encoded,info.settingsStart);raw.set(checksum,info.plainOffset);
  check(identity(raw.subarray(0,BLOCK_SIZE)).checksum===inspection.targetChecksum,'Output map identity verification failed.');
  const output=repack(data,raw,7000);
  const verified=inspectSave(output,{profile});
  check(verified.status==='current'&&verified.build===7000&&verified.checksum===inspection.targetChecksum&&verified.projectileRepairCount===0,'Converted output verification failed.');
  check(equal(output.subarray(48,56),data.subarray(48,56))&&equal(output.subarray(58,64),data.subarray(58,64)),'Save identifiers or duration changed.');
  return {data:output,inspection,changedOffsets:[],projectileRepairs:inspection.nativeDowngrade.projectilesReversed,nativeDowngrade:inspection.nativeDowngrade};
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
