// Narrow, donor-checked MUdb conversion. No saved code is executed or rewritten.
// Player validation: Scarlet (4) loads/resaves/reloads; reverse donor edit crashes.
const encoder=new TextEncoder();
const ESPI=encoder.encode('espi'),TYPE=encoder.encode('lga+bdUM');
const MODEL=encoder.encode('Abilities\\Weapons\\Arrow\\ArrowMissile.mdl\0');
const ERIS=Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8]);
const same=(a,b)=>a.length===b.length&&a.every((byte,i)=>byte===b[i]);
const check=(ok,message)=>{if(!ok)throw Error(`Projectile conversion stopped: ${message}`);};
const read=(data,pos)=>{check(pos>=0&&pos+4<=data.length,'truncated record');return new DataView(data.buffer,data.byteOffset,data.byteLength).getUint32(pos,true);};
const word=value=>{const bytes=new Uint8Array(4);new DataView(bytes.buffer).setUint32(0,value,true);return bytes;};
const key=bytes=>Array.from(bytes).join(',');
function find(data,needle,start=0){
  for(let pos=data.indexOf(needle[0],start);pos>=0;pos=data.indexOf(needle[0],pos+1))if(same(data.subarray(pos,pos+needle.length),needle))return pos;
  return -1;
}
function chain(raw,start){
  const records=[];let pos=start;
  while(same(raw.subarray(pos,pos+4),ESPI)){
    const size=read(raw,pos+4);check(pos+8+size<=raw.length,'record leaves payload');
    records.push({pos,size});pos+=8+size;
  }
  return {records,end:pos};
}

export function projectilePlan(raw,{mapId,build,checksum,targetChecksum,payloadSize}){
  if(mapId!=='undeadre02_06'||build!==7000)return null;
  // A synthetic/no-object fixture is valid for identity repair; it has no MUdb.
  const allocation=find(raw,ESPI);
  if(allocation<0||allocation+12>payloadSize)return null;
  const size=read(raw,allocation+4),count=read(raw,allocation+8);
  if(!count||size!==4+count*16||allocation+8+size>payloadSize)return null;
  const types=new Map();let missileCount=0;
  for(let i=0;i<count;i++){
    const pos=allocation+12+i*16,id=key(raw.subarray(pos+8,pos+16));
    check(!types.has(id),'duplicate native object identifier');
    const type=raw.subarray(pos,pos+8);types.set(id,type);
    if(same(type,TYPE))missileCount++;
  }
  if(!missileCount)return null;
  check(checksum==='b0669dc1'||checksum===targetChecksum,'unverified source map revision');
  const firstStart=find(raw,ESPI,allocation+8+size);check(firstStart>=0,'missing allocation state');
  const first=chain(raw,firstStart),parent=first.end-4;
  check(same(raw.subarray(parent,parent+4),ESPI),'missing enclosing state record');
  const secondStart=find(raw,ESPI,first.end+4);check(secondStart>=0,'missing instance state');
  const second=chain(raw,secondStart);
  check(first.records.length===count&&second.records.length===count,'instance counts disagree');
  const edits=[],recordOffsets=[];let found=0;
  for(let i=0;i<count;i++){
    const a=first.records[i],b=second.records[i],body=raw.subarray(a.pos+8,a.pos+8+a.size);
    if(a.size<84||!same(body.subarray(36,44),body.subarray(76,84)))continue;
    const identifier=body.subarray(36,44);
    if(!same(types.get(key(identifier))||new Uint8Array(),TYPE))continue;
    found++;
    const state=raw.subarray(b.pos+8,b.pos+8+b.size),base=b.pos+8;
    check(find(state,identifier)>=0,'instance object identifier disagrees');
    if([325,345].includes(b.size)&&read(state,104)===0x42556462&&read(state,140)===0x18006&&find(state,MODEL)===185)continue;
    check([321,341].includes(b.size)&&read(state,104)===0&&read(state,140)===0&&read(state,100)===0x18006&&find(state,MODEL)===181,'unrecognized MUdb state layout');
    const parents=[];
    for(let p=find(raw,ESPI);p>=0&&p<b.pos;p=find(raw,ESPI,p+4))if(p+8+read(raw,p+4)>=base+b.size)parents.push(p);
    check(parents.length===1&&parents[0]===parent,'unverified enclosing record lengths');
    edits.push({offset:b.pos+4,remove:4,bytes:word(b.size+4)},
      {offset:base+104,remove:4,bytes:encoder.encode('bdUB')},
      {offset:base+140,remove:0,bytes:word(0x18006)});
    recordOffsets.push(b.pos);
  }
  check(found===missileCount,'not every MUdb instance was identified');
  if(!recordOffsets.length)return null;
  const delta=recordOffsets.length*4;
  edits.push({offset:parent+4,remove:4,bytes:word(read(raw,parent+4)+delta)});
  const eris=find(raw,ERIS);check(eris>=0&&eris>parent,'missing saved Lua section');
  const length=read(raw,eris-4);
  check(read(raw,eris-8)===length+16&&eris+length<=payloadSize,'unverified saved Lua lengths');
  check(raw.subarray(payloadSize).every(byte=>byte===0),'unverified payload padding');
  return {edits:edits.sort((a,b)=>a.offset-b.offset),delta,eris,erisLength:length,records:recordOffsets.length,recordOffsets};
}

export function applyProjectilePlan(raw,plan,payloadSize){
  const size=payloadSize+plan.delta,out=new Uint8Array(Math.ceil(size/1048576)*1048576);
  let source=0,target=0;
  for(const edit of plan.edits){
    check(edit.offset>=source&&edit.offset+edit.remove<=payloadSize,'overlapping edits');
    out.set(raw.subarray(source,edit.offset),target);target+=edit.offset-source;
    out.set(edit.bytes,target);target+=edit.bytes.length;source=edit.offset+edit.remove;
  }
  out.set(raw.subarray(source,payloadSize),target);target+=payloadSize-source;
  check(target===size,'wrong output payload size');
  check(same(out.subarray(plan.eris+plan.delta-16,plan.eris+plan.delta+plan.erisLength),
    raw.subarray(plan.eris-16,plan.eris+plan.erisLength)),'saved Lua section changed');
  // Reversing just the intended edits must restore every meaningful source byte.
  let old=0,current=0;
  for(const edit of plan.edits){
    const length=edit.offset-old;
    check(same(raw.subarray(old,edit.offset),out.subarray(current,current+length)),'unintended state change');
    current+=length+edit.bytes.length;old=edit.offset+edit.remove;
  }
  check(same(raw.subarray(old,payloadSize),out.subarray(current,size)),'unintended state suffix change');
  return {raw:out,payloadSize:size};
}
