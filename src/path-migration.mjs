import {inspectSave,inflateBlock,compressBlock,blockCRC,headerCRC,equal,safePath} from './repair.mjs';
import {PROFILE} from './profiles.mjs';

const BLOCK=1048576,MAX_STRING=2048,decoder=new TextDecoder('utf-8',{fatal:true}),encoder=new TextEncoder();
const ensure=(ok,message)=>{if(!ok)throw Error(message);};
const namespace=encoder.encode('blizzard');
const dv=data=>new DataView(data.buffer,data.byteOffset,data.byteLength);
const read32=(data,pos)=>dv(data).getUint32(pos,true);
const put32=(data,pos,value)=>dv(data).setUint32(pos,value,true);
const join=parts=>{const data=new Uint8Array(parts.reduce((sum,part)=>sum+part.length,0));let pos=0;for(const part of parts){data.set(part,pos);pos+=part.length;}return data;};

function* logicalBlocks(data){
  const size=read32(data,40),count=read32(data,44);let pos=68;
  for(let index=0;index<count;index++){
    const length=read32(data,pos),raw=inflateBlock(data.subarray(pos+12,pos+12+length),BLOCK);
    const used=Math.min(BLOCK,size-index*BLOCK);
    if(index===count-1)ensure(raw.subarray(used).every(byte=>byte===0),'Path migration requires zero-filled final save padding.');
    yield {raw:raw.subarray(0,used),offset:index*BLOCK,index,containerOffset:pos};pos+=12+length;
  }
}

function checkpointPath(text){
  if(!/^blizzard[\\/]/i.test(text))return null;
  const parts=text.replaceAll('\\','/').split('/');
  if(parts.length<2||!parts[1]||/^zones$/i.test(parts[1]))return null;
  if(parts.length!==2&&(parts.length!==3||!/^[a-z0-9_]+\.w3z$/i.test(parts[2])))return null;
  safePath(parts.join('/'));
  return {folder:parts[1],suffix:text.slice(9+parts[1].length)};
}

export function collectPathEdits(data,targetFolder){
  safePath(`Blizzard/${targetFolder}`);ensure(!targetFolder.includes('/')&&!targetFolder.includes('\\')&&!/^zones$/i.test(targetFolder),'Invalid repaired companion folder.');
  const edits=[],seen=new Set();let tail=new Uint8Array(),recognizedRecords=0;
  for(const block of logicalBlocks(data)){
    const buffer=join([tail,block.raw]),base=block.offset-tail.length;
    for(let pos=0;pos<buffer.length;){
      const upper=buffer.indexOf(66,pos),lower=buffer.indexOf(98,pos);
      pos=upper<0?lower:lower<0?upper:Math.min(upper,lower);if(pos<0)break;
      const at=pos++;if(at+9>buffer.length)continue;
      if(!namespace.every((byte,i)=>(buffer[at+i]|32)===byte)||![47,92].includes(buffer[at+8]))continue;
      if(at<12||read32(buffer,at-12)!==4)continue;
      const length=dv(buffer).getBigUint64(at-8,true);
      if(length===0n||length>BigInt(MAX_STRING)||at+Number(length)>buffer.length)continue;
      const offset=base+at-8;if(seen.has(offset))continue;seen.add(offset);
      let before;try{before=decoder.decode(buffer.subarray(at,at+Number(length)));}catch{continue;}
      const path=checkpointPath(before);if(!path)continue;recognizedRecords++;if(path.folder===targetFolder)continue;
      const after=before.slice(0,9)+targetFolder+path.suffix,bytes=encoder.encode(after);
      ensure(bytes.length<=MAX_STRING,'The repaired path exceeds the supported string length.');
      const replacement=new Uint8Array(8+bytes.length);dv(replacement).setBigUint64(0,BigInt(bytes.length),true);replacement.set(bytes,8);
      edits.push({offset,before,after,old:buffer.slice(at-8,at+Number(length)),replacement});
    }
    tail=buffer.slice(-MAX_STRING-12);
  }
  edits.sort((a,b)=>a.offset-b.offset);
  let end=0;for(const edit of edits){ensure(edit.offset>=end,'Overlapping saved path records.');end=edit.offset+edit.old.length;}
  return {edits,recognizedRecords};
}

// Splice only verified string records, preserving every intervening byte.
function* spliceBlocks(blocks,edits,start=0){
  let index=0,skipUntil=start;
  for(const block of blocks){
    const end=block.offset+block.raw.length;if(end<=start)continue;
    let pos=Math.max(block.offset,start,Math.min(end,skipUntil));
    while(pos<end){
      const edit=edits[index];
      if(!edit||edit.offset>=end){yield block.raw.subarray(pos-block.offset);break;}
      if(pos<edit.offset){yield block.raw.subarray(pos-block.offset,edit.offset-block.offset);pos=edit.offset;}
      ensure(pos===edit.offset,'A saved path splice is out of order.');
      yield edit.replacement;skipUntil=edit.offset+edit.old.length;pos=Math.min(end,skipUntil);index++;
    }
  }
  ensure(index===edits.length,'A saved path record lies beyond the payload.');
}

function verifyInverse(source,output,edits){
  let delta=0;
  const reverse=edits.map(edit=>{const result={offset:edit.offset+delta,old:edit.replacement,replacement:edit.old};delta+=edit.replacement.length-edit.old.length;return result;});
  const original=logicalBlocks(source);let block=original.next(),pos=0;
  for(const segment of spliceBlocks(logicalBlocks(output),reverse)){
    let index=0;
    while(index<segment.length){
      ensure(!block.done,'Path migration added unexpected gameplay bytes.');
      const size=Math.min(segment.length-index,block.value.raw.length-pos);
      ensure(equal(segment.subarray(index,index+size),block.value.raw.subarray(pos,pos+size)),'Path migration changed bytes outside the saved path records.');
      index+=size;pos+=size;if(pos===block.value.raw.length){block=original.next();pos=0;}
    }
  }
  ensure(block.done,'Path migration lost gameplay bytes.');
}

export function migrateSavePaths(input,targetFolder){
  const data=input instanceof Uint8Array?input:new Uint8Array(input),inspection=inspectSave(data);
  ensure(read32(data,48)===PROFILE.gameIdentifier&&read32(data,52)===PROFILE.gameVersion&&PROFILE.serializationBuilds.includes(inspection.build),'This save format has not been checked for companion-folder migration.');
  const {edits,recognizedRecords}=collectPathEdits(data,targetFolder);
  if(!edits.length)return {data,edits:[],recognizedRecords,payloadDelta:0,verified:true};
  const payloadDelta=edits.reduce((sum,edit)=>sum+edit.replacement.length-edit.old.length,0);
  const size=read32(data,40)+payloadDelta,count=Math.ceil(size/BLOCK);ensure(size>0&&count<=2048,'The renamed save exceeds the supported payload size.');
  const first=Math.floor(edits[0].offset/BLOCK);let prefixEnd=68;
  for(let index=0;index<first;index++)prefixEnd+=12+read32(data,prefixEnd);
  const parts=[data.subarray(68,prefixEnd)];let raw=new Uint8Array(BLOCK),used=0,written=first;
  const flush=()=>{const compressed=compressBlock(raw);ensure(equal(inflateBlock(compressed,BLOCK),raw),'A migrated block failed its compression round-trip.');const header=new Uint8Array(12);put32(header,0,compressed.length);put32(header,4,BLOCK);put32(header,8,blockCRC(compressed,BLOCK));parts.push(header,compressed);written++;raw=new Uint8Array(BLOCK);used=0;};
  for(const segment of spliceBlocks(logicalBlocks(data),edits,first*BLOCK)){
    for(let pos=0;pos<segment.length;){const length=Math.min(BLOCK-used,segment.length-pos);raw.set(segment.subarray(pos,pos+length),used);used+=length;pos+=length;if(used===BLOCK)flush();}
  }
  if(used)flush();ensure(written===count,'The migrated save block count is inconsistent.');
  const header=data.slice(0,68);put32(header,32,68+parts.reduce((sum,part)=>sum+part.length,0));put32(header,40,size);put32(header,44,count);put32(header,64,headerCRC(header));
  const output=join([header,...parts]);const checked=inspectSave(output);
  ensure(checked.checksum===inspection.checksum&&equal(output.subarray(48,64),data.subarray(48,64)),'Path migration changed the map identity or save build.');
  verifyInverse(data,output,edits);
  return {data:output,payloadDelta,recognizedRecords,verified:true,edits:edits.map(({offset,before,after})=>({offset,before,after}))};
}
