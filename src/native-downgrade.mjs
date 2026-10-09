// Native Warcraft III 3.0.1 (save build 7003) -> restored 3.0.0 (build 7000) conversion.
// Port of the private research converter. Player validation: six converted Scarlet Monastery
// checkpoints, from the start through the later boss state, loaded in 3.0.0 and re-saved and
// reloaded. Saved Lua is parsed as data and never executed.
const encoder=new TextEncoder(),decoder=new TextDecoder();
const ESPI=encoder.encode('espi'),UNIT=encoder.encode('lga+u3w+'),MISSILE=encoder.encode('lga+bdUM'),CAMERA=encoder.encode('lga+mac+');
const AGENT=encoder.encode('lga+'),BUFF=encoder.encode('bdUB');
// A projectile's model path is printable and ends in .mdl/.mdx with a terminating zero.
function modelAt(body,at){
  const end=body.indexOf(0,at);
  if(end<at+5)return false;
  const path=body.subarray(at,end);
  return path.every(x=>x>=32&&x<127)&&/\.md[lx]$/i.test(decoder.decode(path));
}
const ERIS=Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8]);
const LUA_TAG=Uint8Array.from([0x8e,0x31,0x46,0x1c]);
const UNIT_SUFFIX=Uint8Array.from([255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0]);

// Natives renamed with identical signatures in 3.0.1, mapped back to their 3.0.0 names.
export const API_ALIASES=Object.freeze({
  BlzGetEquippedItem:'GetEquippedItem',BlzUnitItemInEquipmentSlot:'UnitItemInEquipmentSlot',
  BlzUnitHasItemEquipped:'UnitHasItemEquipped',BlzIsItemEquipped:'IsItemEquipped',
  BlzUnitHasLoadoutSlotEmpty:'UnitHasLoadoutSlotEmpty',BlzUnitHasItemBagged:'UnitHasItemBagged',
  BlzUnitItemInBagSlot:'UnitItemInBagSlot',BlzUnitCanEquipItemOfEquipmentType:'UnitCanEquipItemOfEquipmentType',
  BlzGetItemEquipmentType:'GetItemEquipmentType',BlzGetUnequippedItem:'GetUnequippedItem',
  BlzUnitUnequipItem:'UnitUnequipItem',BlzUnitEquipItem:'UnitEquipItem',
  BlzUnitHasItemEquipmentOfType:'UnitHasItemEquipmentOfType',BlzIsItemInBag:'IsItemInBag',
  BlzSetItemColor:'SetItemColor',BlzGetItemTag:'GetItemTag',
  BlzUnitExtendedInventorySize:'UnitExtendedInventorySize',BlzUnitUnequipItemFromSlot:'UnitUnequipItemFromSlot'});
// Natives without a 3.0.0 counterpart; removed only when nothing besides their _G binding uses them.
export const API_REMOVED=Object.freeze(['BlzGetCameraAllowsHotkeyTargetLock','BlzGetHUDScale','BlzRemoveEffect',
  'BlzResetUnitTalents','BlzSetCameraAllowsHotkeyTargetLock','BlzSetThematicMusicAbsoluteVolume',
  'BlzUnitHasAnyItemEquipped','BlzUnitHeal','ChooseRandomItemExWithFilterAndIncludes']);
// Saved scripts from the 3.0.1 map revisions call some of those natives (inside 3.0.1 blizzard.j
// helpers). These are rebound to the closest 3.0.0 behaviour; every effect is reported.
export const API_FALLBACKS=Object.freeze({
  BlzRemoveEffect:{native:'DestroyEffect',effect:'effects removed by scripts play their death animation instead of vanishing'},
  ChooseRandomItemExWithFilterAndIncludes:{native:'ChooseRandomItemExWithFilter',effect:'random item drops ignore the two 3.0.1 include options'},
  BlzSetThematicMusicAbsoluteVolume:{native:'SetThematicMusicVolume',effect:'thematic music volume uses the 3.0.0 setting'},
  BlzSetCameraAllowsHotkeyTargetLock:{noop:true,effect:'the 3.0.1 camera hotkey target-lock option is ignored'},
  BlzUnitHeal:{noop:true,effect:'the 3.0.1 healing function does nothing'}});

const check=(ok,message)=>{if(!ok)throw Error(`Native 3.0.1 downgrade stopped: ${message}`);};
const same=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
const dv=data=>new DataView(data.buffer,data.byteOffset,data.byteLength);
const u32=(data,pos)=>{check(pos>=0&&pos+4<=data.length,'truncated record');return dv(data).getUint32(pos,true);};
const put32=(data,pos,value)=>dv(data).setUint32(pos,value,true);
const word=value=>{const out=new Uint8Array(4);put32(out,0,value);return out;};
const id=bytes=>Array.from(bytes,x=>x.toString(16).padStart(2,'0')).join('');
function find(data,needle,start=0){
  for(let pos=data.indexOf(needle[0],start);pos>=0;pos=data.indexOf(needle[0],pos+1))if(same(data.subarray(pos,pos+needle.length),needle))return pos;
  return -1;
}
export function splice(raw,edits){
  edits=[...edits].sort((a,b)=>a.offset-b.offset);
  const out=new Uint8Array(raw.length+edits.reduce((n,e)=>n+e.bytes.length-e.remove,0));
  let source=0,target=0;
  for(const e of edits){
    check(e.offset>=source&&e.offset+e.remove<=raw.length,'overlapping edits');
    out.set(raw.subarray(source,e.offset),target);target+=e.offset-source;
    out.set(e.bytes,target);target+=e.bytes.length;source=e.offset+e.remove;
  }
  out.set(raw.subarray(source),target);
  return out;
}

// ---- Eris graph reader. Iterative: saved graphs nest thousands of levels deep.
const NIL=Object.freeze({tag:0}),SCALAR=Object.freeze({tag:-1});
export function parseEris(raw,start){
  const view=dv(raw);let pos=start;
  const take=n=>{check(n>=0&&pos+n<=raw.length,`invalid Lua size at ${pos}`);const at=pos;pos+=n;return at;};
  const i32=()=>view.getInt32(take(4),true),u8=()=>raw[take(1)];
  const u64=()=>{const at=take(8);check(view.getUint32(at+4,true)===0,`unsupported Lua value at ${at}`);return view.getUint32(at,true);};
  const count=()=>{const n=i32();check(n>=0&&n<=1000000,`invalid Lua count at ${pos-4}`);return n;};
  const flag=()=>{const v=u8();check(v===0||v===1,`invalid Lua flag at ${pos-1}`);return v;};
  const refs=[null],usePositions=[],useRefs=[],tasks=[];
  const value=done=>tasks.push(()=>read(done));
  const seq=(n,done)=>{let i=0;const step=()=>{if(i++<n)value(step);else done();};step();};
  function read(done){
    const at=pos,tag=i32();
    if(tag>14){const ref=tag-14;check(ref<refs.length,`invalid Lua reference at ${at}`);usePositions.push(at);useRefs.push(ref);return done(refs[ref]);}
    if(tag===0)return done(NIL);
    if(tag===1){flag();return done(SCALAR);}
    if(tag===2){take(8);return done(SCALAR);}
    if(tag===3){flag();take(4);return done(SCALAR);}
    check([4,5,6,7,8,9,12,13].includes(tag),`unsupported Lua tag ${tag} at ${at}`);
    const node={tag,start:at,end:0,ref:refs.length};refs.push(node);
    // Completion is deferred so long chains of closing nodes cannot recurse.
    const finish=()=>{node.end=pos;tasks.push(()=>done(node));};
    if(tag===4){node.size=u64();node.text=take(node.size);return finish();}
    if(tag===12)return value(finish);
    if(tag===13){node.kind=u8();return value(child=>{node.child=child;finish();});}
    if(tag===5||tag===7){
      if(flag())return value(finish);
      if(tag===7){const size=u64();take(4);take(size);return value(finish);}
      take(4);node.pairs=[];
      const entry=()=>value(k=>{
        if(k.tag===0)return value(finish);
        value(v=>{check(v.tag!==0,'nil table value');if(k.tag===4)node.pairs.push([k,v]);entry();});
      });
      return entry();
    }
    if(tag===6){node.isC=flag();const upvalues=u8();return value(()=>seq(upvalues,finish));}
    if(tag===9){
      take(11);const code=count();node.code=take(code*4);node.codeSize=code*4;
      return seq(count(),()=>seq(count(),()=>{
        const upvalues=count();take(upvalues*2);
        if(!flag())return finish();
        value(()=>{
          take(count()*4);let locals=count();
          const local=()=>{if(locals-->0){take(8);value(local);}else seq(upvalues,finish);};
          local();
        });
      }));
    }
    // tag 8: coroutine
    take(13);const stackSize=count(),used=u64();check(used<=stackSize,'thread stack exceeds allocation');
    return seq(used,()=>{
      const status=u8();u64();
      const openUpvalues=()=>{if(!u64())return finish();value(openUpvalues);};
      const frame=()=>{
        u64();u64();take(2);const call=u8();
        const next=()=>{if(!flag())return frame();if(status===1)u64();openUpvalues();};
        if(call&&(call&16))u64();
        if(call&&(call&2)){u64();u64();}
        else if(call&&flag()){take(4);return value(next);}
        next();
      };
      frame();
    });
  }
  check(same(raw.subarray(pos,pos+12),ERIS),'missing Eris header');pos+=12;
  let root=null;value(v=>{root=v;});
  while(tasks.length)tasks.pop()();
  check(root,'incomplete saved Lua graph');
  return {start,end:pos,root,refs,usePositions,useRefs};
}
export const text=(raw,node)=>node?.tag===4?decoder.decode(raw.subarray(node.text,node.text+node.size)):null;
const fields=(raw,table)=>{check(table?.tag===5&&table.pairs,'missing saved Lua table');return new Map(table.pairs.map(([k,v])=>[text(raw,k),v]));};

// The record around Eris: tag, outer length, N, 0, N pending trigger-wait IDs, size+16, size.
export function luaFrame(raw,eris,size){
  check(u32(raw,eris-4)===size&&u32(raw,eris-8)===size+16,'unverified saved Lua lengths');
  for(let waits=0;waits<256;waits++){
    const tag=eris-24-4*waits;
    if(tag>=0&&same(raw.subarray(tag,tag+4),LUA_TAG)&&u32(raw,tag+8)===waits&&u32(raw,tag+12)===0&&u32(raw,tag+4)===size+28+4*waits)
      return {tag,waits,waitIds:Array.from({length:waits},(_,i)=>u32(raw,tag+16+4*i))};
  }
  check(false,'unrecognized saved Lua record header');
}
export function setLuaLengths(raw,frame,size){
  const eris=frame.tag+24+4*frame.waits;
  put32(raw,frame.tag+4,size+28+4*frame.waits);put32(raw,eris-8,size+16);put32(raw,eris-4,size);
}

function inlineString(value){
  const bytes=encoder.encode(value),out=new Uint8Array(12+bytes.length);
  put32(out,0,4);put32(out,4,bytes.length);out.set(bytes,12);return out;
}
function migrateApi(raw){
  const eris=find(raw,ERIS);check(eris>=0,'missing saved Lua section');
  const graph=parseEris(raw,eris),frame=luaFrame(raw,eris,graph.end-eris);
  const uses=new Map();
  for(let i=0;i<graph.useRefs.length;i++){const ref=graph.useRefs[i];if(!uses.has(ref))uses.set(ref,[]);uses.get(ref).push(graph.usePositions[i]);}
  const global=fields(raw,fields(raw,graph.refs[1]).get('_LOADED')).get('_G');fields(raw,global);
  const bindings=new Map(global.pairs.map(([k,v])=>[text(raw,k),[k,v]]));
  // spans: original byte ranges whose reference tokens are not rebased; inserted: positions of new nodes.
  const spans=[],deleted=new Set(),inserted=[],edits=[],noops=[],fallbacks=[],removed=[];
  for(const name of API_REMOVED){
    const [k,v]=bindings.get(name)||[];
    check(k&&v,`missing expected 3.0.1 native ${name}`);
    check(v.tag===13&&v.kind===6&&v.child===k&&u32(raw,k.start)===4,`unexpected ${name} binding`);
    const keyUses=uses.get(k.ref)||[];
    check(v.end===v.start+9&&keyUses.includes(v.start+5),`unexpected ${name} binding layout`);
    const fallback=API_FALLBACKS[name];
    // Scripts from the 3.0.1 map revisions call some of these natives; 3.0.0 lacks them.
    const blocked=`this save's scripts use ${name}, which exists only in 3.0.1 and has no 3.0.0 replacement. The save comes from the 3.0.1 version of this map and cannot be downgraded.`;
    check(!uses.has(v.ref),blocked);
    if(keyUses.length===1){
      check(v.start===k.end,`unexpected ${name} binding layout`);
      spans.push([k.start,v.end]);deleted.add(k.ref);deleted.add(v.ref);removed.push(name);
      edits.push({offset:k.start,remove:v.end-k.start,bytes:new Uint8Array()});
      continue;
    }
    check(fallback,blocked);
    if(fallback.native){
      const [,target]=bindings.get(fallback.native)||[];
      check(target?.tag===13&&target.kind===6&&text(raw,target.child)===fallback.native,`missing 3.0.0 native ${fallback.native}`);
      // Keep the global name; point its native binding at the 3.0.0 function by name.
      spans.push([v.start+5,v.end]);inserted.push(v.start+5);
      edits.push({offset:v.start+5,remove:4,bytes:inlineString(fallback.native)});
    }else{
      const [,noop]=bindings.get('DoNothing')||[];
      check(noop?.tag===6&&noop.isC===0&&noop.start<v.start,`no 3.0.0 replacement for ${name}`);
      spans.push([v.start,v.end]);deleted.add(v.ref);noops.push({v,noop});
    }
    fallbacks.push({native:name,replacement:fallback.native||'DoNothing',effect:fallback.effect});
  }
  for(const [name,legacy] of Object.entries(API_ALIASES)){
    const matches=graph.refs.filter(node=>node?.tag===13&&node.kind===6&&node.child?.tag===4&&text(raw,node.child)===name);
    check(matches.length===1,`ambiguous or missing native ${name}`);
    const string=matches[0].child;check(u32(raw,string.start)===4,`unexpected ${name} string`);
    edits.push({offset:string.start,remove:string.end-string.start,bytes:inlineString(legacy)});
  }
  // Renumber references: objects are numbered in stream order.
  inserted.sort((a,b)=>a-b);
  const mapping=new Int32Array(graph.refs.length);let removedBefore=0,insertedBefore=0;
  for(let ref=1;ref<graph.refs.length;ref++){
    while(insertedBefore<inserted.length&&inserted[insertedBefore]<graph.refs[ref].start)insertedBefore++;
    if(deleted.has(ref)){removedBefore++;mapping[ref]=-1;}else mapping[ref]=ref-removedBefore+insertedBefore;
  }
  for(const {v,noop} of noops)edits.push({offset:v.start,remove:v.end-v.start,bytes:word(mapping[noop.ref]+14)});
  const work=raw.slice();let rebased=0;
  for(let i=0;i<graph.useRefs.length;i++){
    const pos=graph.usePositions[i],ref=graph.useRefs[i];
    if(spans.some(([a,b])=>a<=pos&&pos<b))continue;
    check(mapping[ref]>0,'a removed native is still referenced');
    if(mapping[ref]!==ref){put32(work,pos,mapping[ref]+14);rebased++;}
  }
  const edited=splice(work,edits),delta=edited.length-raw.length,size=graph.end-eris+delta;
  setLuaLengths(edited,frame,size);
  const checked=parseEris(edited,eris);
  check(checked.end===graph.end+delta&&checked.refs.length===graph.refs.length-deleted.size+inserted.length,'saved Lua graph changed unexpectedly');
  for(let ref=1;ref<graph.refs.length;ref++){
    if(mapping[ref]<0)continue;
    const before=graph.refs[ref],after=checked.refs[mapping[ref]];
    check(before.tag===after.tag,'saved Lua object types changed');
    if(before.tag===4){const old=text(raw,before);check(text(edited,after)===(Object.hasOwn(API_ALIASES,old)?API_ALIASES[old]:old),'saved Lua string changed');}
    if(before.tag===9)check(same(raw.subarray(before.code,before.code+before.codeSize),edited.subarray(after.code,after.code+after.codeSize)),'saved Lua bytecode changed');
  }
  // The rewritten globals must now resolve to the intended 3.0.0 functions.
  const after=fields(edited,fields(edited,fields(edited,checked.refs[1]).get('_LOADED')).get('_G'));
  for(const name of removed)check(!after.has(name),`${name} was not removed`);
  for(const row of fallbacks){
    const value=after.get(row.native);
    if(row.replacement==='DoNothing')check(value===after.get('DoNothing'),`${row.native} fallback not bound`);
    else check(value?.tag===13&&text(edited,value.child)===row.replacement,`${row.native} fallback not bound`);
  }
  check(same(edited.subarray(checked.end),raw.subarray(graph.end)),'data after saved Lua changed');
  check(same(edited.subarray(0,frame.tag+4),raw.subarray(0,frame.tag+4)),'data before saved Lua changed');
  check(JSON.stringify(luaFrame(edited,eris,size).waitIds)===JSON.stringify(frame.waitIds),'pending trigger waits changed');
  return {raw:edited,report:{aliases:Object.keys(API_ALIASES).length,removedUnusedGlobals:removed,scriptFallbacks:fallbacks,
    removedReferences:deleted.size,rebasedReferences:rebased,luaSizeDelta:delta,pendingWaits:frame.waits}};
}

// ---- Native object graph.
function chain(raw,start){
  const records=[];let pos=start;
  while(same(raw.subarray(pos,pos+4),ESPI)){const size=u32(raw,pos+4);check(pos+8+size<=raw.length,'record leaves payload');records.push({pos,size});pos+=8+size;}
  return {records,end:pos};
}
function bounded(raw,start,end){
  const records=[];
  while(start<end){check(same(raw.subarray(start,start+4),ESPI),'unverified auxiliary record');const size=u32(raw,start+4);check(start+8+size<=end,'auxiliary record leaves parent');records.push({pos:start,size});start+=8+size;}
  check(start===end,'auxiliary records do not fill their parent');
  return records;
}
// The allocation table is the first espi record whose size matches its count and whose
// constructor/state chains hold exactly that many objects; earlier save text can contain "espi".
function layout(raw){
  let failure;
  for(let allocation=find(raw,ESPI);allocation>=0;allocation=find(raw,ESPI,allocation+4)){
    if(allocation+12>raw.length)break;
    const size=u32(raw,allocation+4),count=u32(raw,allocation+8);
    if(!count||size!==4+16*count||allocation+8+size>raw.length)continue;
    try{return layoutAt(raw,allocation,size,count);}catch(error){failure??=error;}
  }
  throw failure||Error('Native 3.0.1 downgrade stopped: missing native allocation table');
}
function layoutAt(raw,allocation,size,count){
  const types=new Map();
  for(let i=0;i<count;i++){const pos=allocation+12+i*16,key=id(raw.subarray(pos+8,pos+16));check(!types.has(key),'duplicate native object');types.set(key,raw.subarray(pos,pos+8));}
  const tableEnd=allocation+8+size,firstStart=find(raw,ESPI,tableEnd);check(firstStart>=0,'missing native constructors');
  const first=chain(raw,firstStart),enclosing=first.end-4;
  check(same(raw.subarray(enclosing,enclosing+4),ESPI),'missing enclosing state record');
  const secondStart=find(raw,ESPI,first.end+4);check(secondStart>=0,'missing native states');
  const second=chain(raw,secondStart);
  check(first.records.length===count&&second.records.length===count,'native object counts disagree');
  return {allocation,count,types,tableEnd,first:first.records,firstEnd:first.end,enclosing,second:second.records};
}
function states(raw,native=layout(raw)){
  const result=new Map(),limit=native.enclosing+8+u32(raw,native.enclosing+4);
  for(let i=0;i<native.count;i++){
    const a=native.first[i],b=native.second[i];
    if(a.size<84)continue;
    const body=raw.subarray(a.pos+8,a.pos+8+a.size);
    if(!same(body.subarray(36,44),body.subarray(76,84)))continue;
    const key=id(body.subarray(36,44)),type=native.types.get(key);
    if(!type||!same(type.subarray(0,4),AGENT))continue;
    check(!result.has(key),'duplicate native state');check(b.pos+8+b.size<=limit,'native state leaves its parent');
    result.set(key,{type,pos:b.pos,size:b.size});
  }
  const units=[...native.types.values()].filter(type=>same(type,UNIT)).length;
  check([...result.values()].filter(row=>same(row.type,UNIT)).length===units,'not every unit state was identified');
  return result;
}
function validateLengths(raw){
  const native=layout(raw),parent=native.first[0].pos-376;
  check(u32(raw,parent+4)===368&&u32(raw,parent)===native.first.at(-1).pos-parent,'unverified constructor parent length');
  check(u32(raw,native.firstEnd)===native.second.at(-1).pos-native.firstEnd,'unverified state parent length');
  return native;
}

function luaStart(raw){const eris=find(raw,ERIS);check(eris>=0,'missing saved Lua section');return luaFrame(raw,eris,u32(raw,eris-4)).tag;}
function migrateNative(raw){
  const native=layout(raw),records=states(raw,native),edits=[];
  let units=0,missiles=0,oldMissiles=0,delta=0;
  for(const row of records.values()){
    const body=raw.subarray(row.pos+8,row.pos+8+row.size);let replacement=null;
    if(same(row.type,UNIT)){
      // 3.0.1 inserts a zero dword 665 bytes before the end (just before an existing field that can
      // hold 0x10000) and appends a 16-byte suffix.
      const insert=body.length-665;
      check(insert>=0&&same(body.subarray(-16),UNIT_SUFFIX)&&u32(body,insert)===0,'unrecognized 3.0.1 unit layout');
      replacement=new Uint8Array(body.length-20);replacement.set(body.subarray(0,insert));replacement.set(body.subarray(insert+4,body.length-16),insert);units++;
    }else if(same(row.type,MISSILE)){
      // Projectile states (any missile model): 3.0.1 inserts a 0x18006 dword at 140, moving the
      // model path from 181 to 185, and stores buff BUdb at 104 where 3.0.0 projectiles have none.
      check(u32(body,100)===0x18006,'unrecognized projectile layout');
      if(u32(body,140)===0x18006&&same(body.subarray(104,108),BUFF)&&modelAt(body,185)){
        replacement=new Uint8Array(body.length-4);replacement.set(body.subarray(0,140));replacement.set(body.subarray(144),140);
        replacement.fill(0,104,108);
        missiles++;
      }else{
        check(u32(body,140)===0&&modelAt(body,181),'unrecognized projectile layout');
        oldMissiles++;
      }
    }
    if(replacement){delta+=replacement.length-body.length;edits.push({offset:row.pos+4,remove:4,bytes:word(replacement.length)},{offset:row.pos+8,remove:body.length,bytes:replacement});}
  }
  check(units>0,'no native unit states found');
  edits.push({offset:native.enclosing+4,remove:4,bytes:word(u32(raw,native.enclosing+4)+delta)});
  const edited=splice(raw,edits),after=states(edited);
  check(after.size===records.size,'native objects changed');
  const replaced=new Map(edits.filter((_,i)=>i%2===1).map(e=>[e.offset-8,e.bytes]));
  for(const [key,row] of records){
    const now=after.get(key);check(now&&same(now.type,row.type),'native objects changed');
    check(same(edited.subarray(now.pos+8,now.pos+8+now.size),replaced.get(row.pos)||raw.subarray(row.pos+8,row.pos+8+row.size)),'unintended native state change');
  }
  const lua=luaStart(raw);check(same(edited.subarray(edited.length-(raw.length-lua)),raw.subarray(lua)),'saved Lua changed during native migration');
  validateLengths(edited);
  return {raw:edited,report:{units,projectilesReversed:missiles,alreadyOldProjectiles:oldMissiles,nativeSizeDelta:delta}};
}

// The 3.0.1 camera state adds one dword (01000000) at body offset 304.
function migrateCamera(raw){
  const native=layout(raw),start=native.tableEnd;
  const size=u32(raw,start),count=u32(raw,start+4);check(count>1&&size===4+16*count,'unverified auxiliary allocation table');
  const cameras=[];for(let i=0;i<count;i++)if(same(raw.subarray(start+8+i*16,start+16+i*16),CAMERA))cameras.push(i);
  check(cameras.length===1&&cameras[0]>0,'unrecognized camera state');
  const root=native.second.at(-1),constructionRoot=native.first.at(-1);
  const construction=bounded(raw,constructionRoot.pos+12+u32(raw,constructionRoot.pos+8),constructionRoot.pos+8+constructionRoot.size-4);
  const leaves=bounded(raw,root.pos+12+u32(raw,root.pos+8),root.pos+8+root.size-4);
  check(construction.length===count-1&&leaves.length===count-1,'auxiliary object counts disagree');
  const camera=leaves[cameras[0]-1];
  check(camera.size===945&&u32(raw,camera.pos+8+304)===1,'unrecognized 3.0.1 camera layout');
  const edited=splice(raw,[{offset:camera.pos+4,remove:4,bytes:word(941)},{offset:camera.pos+8+304,remove:4,bytes:new Uint8Array()},
    {offset:root.pos+4,remove:4,bytes:word(root.size-4)}]);
  const lua=luaStart(raw);check(same(edited.subarray(edited.length-(raw.length-lua)),raw.subarray(lua)),'saved Lua changed during camera migration');
  validateLengths(edited);
  return {raw:edited,report:{cameraBodyBytes:[945,941]}};
}

// Convert the meaningful payload of a recognized-map build-7003 save. Map identity is handled by the caller.
export function downgradeNativePayload(payload){
  validateLengths(payload);
  const api=migrateApi(payload),native=migrateNative(api.raw),camera=migrateCamera(native.raw);
  return {raw:camera.raw,report:{...api.report,...native.report,...camera.report}};
}
