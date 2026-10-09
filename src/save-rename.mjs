// Output naming: a converted checkpoint is saved as <name>_<downgraded|upgraded>_<patch> and its
// companion folder (Blizzard\<name> or FKManualSaves\<name>) is renamed to match. The campaign
// script stores that folder as Lua strings in the main save, so those strings are rewritten with
// every Lua length updated. (An earlier attempt changed the strings without the lengths and crashed.)
import {parseEris,luaFrame,setLuaLengths,splice,text} from './native-downgrade.mjs';

const ERIS=Uint8Array.from([69,82,73,83,4,82,6,158,191,4,4,8]);
const encoder=new TextEncoder();
const check=(ok,message)=>{if(!ok)throw Error(`Renaming stopped: ${message}`);};
const slash=path=>path.replaceAll('\\','/');

export const outputSuffix=profile=>`${profile.direction==='downgrade'?'downgraded':'upgraded'}_${profile.to}`;
export function renamedStem(stem,profile){return `${stem}_${outputSuffix(profile)}`;}

function find(data,needle,start=0){
  for(let pos=data.indexOf(needle[0],start);pos>=0;pos=data.indexOf(needle[0],pos+1)){
    let ok=true;for(let i=1;i<needle.length&&ok;i++)ok=data[pos+i]===needle[i];
    if(ok)return pos;
  }
  return -1;
}
function inlineString(value){
  const bytes=encoder.encode(value),out=new Uint8Array(12+bytes.length),view=new DataView(out.buffer);
  view.setUint32(0,4,true);view.setUint32(4,bytes.length,true);out.set(bytes,12);return out;
}
// Map a stored path to its renamed form, keeping the stored separator style; null if unrelated.
function renamePath(value,folders){
  const normalized=slash(value).toLowerCase();
  for(const [from,to] of folders){
    const key=from.toLowerCase();
    if(normalized!==key&&!normalized.startsWith(key+'/'))continue;
    const separator=value.includes('\\')?'\\':'/';
    return to.replaceAll('/',separator)+value.slice(from.length);
  }
  return null;
}

// folders: [[old campaign-relative folder, new folder], ...] using '/' separators.
export function renameStoredFolders(payload,folders){
  // A mention is the folder path not followed by another name character (so before_Act_2 does
  // not match before_Act_2_2 or the renamed before_Act_2_downgraded_3.0.0).
  const patterns=folders.map(([from])=>new RegExp(from.replace(/[.*+?^${}()|[\]\\/]/g,'\\$&')+'(?![A-Za-z0-9_])','gi'));
  const mentions=raw=>{const textual=new TextDecoder('latin1').decode(raw).replaceAll('\\','/');return patterns.reduce((n,p)=>n+(textual.match(p)?.length||0),0);};
  if(!mentions(payload))return {raw:payload,renamed:[]};
  const eris=find(payload,ERIS);check(eris>=0,'stored companion paths found without a saved Lua section');
  const graph=parseEris(payload,eris),frame=luaFrame(payload,eris,graph.end-eris);
  const edits=[],renamed=[];
  for(const node of graph.refs){
    if(node?.tag!==4)continue;
    const before=text(payload,node),after=renamePath(before,folders);
    if(after===null)continue;
    edits.push({offset:node.start,remove:node.end-node.start,bytes:inlineString(after)});
    renamed.push({before,after});
  }
  // Every mention must be one of the rewritten strings, nothing in native data.
  check(mentions(payload.subarray(0,eris))===0&&mentions(payload.subarray(graph.end))===0,'companion folder named outside the saved Lua');
  const edited=splice(payload,edits),delta=edited.length-payload.length;
  setLuaLengths(edited,frame,graph.end-eris+delta);
  const checked=parseEris(edited,eris);
  check(checked.end===graph.end+delta&&checked.refs.length===graph.refs.length,'saved Lua graph changed unexpectedly');
  for(let ref=1;ref<graph.refs.length;ref++){
    const a=graph.refs[ref],b=checked.refs[ref];
    check(a.tag===b.tag,'saved Lua object types changed');
    if(a.tag===4){const old=text(payload,a);check(text(edited,b)===(renamePath(old,folders)??old),'saved Lua string changed');}
  }
  check(mentions(edited)===0,'old companion folder still referenced');
  const size=checked.end-eris;
  check(JSON.stringify(luaFrame(edited,eris,size).waitIds)===JSON.stringify(frame.waitIds),'pending trigger waits changed');
  return {raw:edited,renamed};
}
