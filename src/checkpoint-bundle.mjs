import {safePath,assertUniquePaths} from './repair.mjs';

export function indexFolder(files){
  const entries=files.map(blob=>({path:safePath(blob.webkitRelativePath||blob.name),blob}));
  assertUniquePaths(entries);
  const checkpoints=entries.filter(entry=>entry.path.toLowerCase().endsWith('.w3z')&&
    !/^undeadre\d+(?:_\d+)?\.w3z$/i.test(entry.path.split('/').at(-1))&&
    !entry.path.split('/').slice(0,-1).some(part=>/^(blizzard|customsaves|fkmanualsaves)$/i.test(part)));
  checkpoints.sort((a,b)=>(b.blob.lastModified||0)-(a.blob.lastModified||0)||a.path.localeCompare(b.path));
  return {entries,checkpoints:checkpoints.map(entry=>({path:entry.path,name:entry.path.split('/').at(-1).slice(0,-4),size:entry.blob.size}))};
}

// References can span compressed-block boundaries. Collect directory names,
// never rewrite the saved Lua strings or use another checkpoint's working Zones.
export function companionReferenceScanner(){
  const folders=new Set(),files=new Set();const decoder=new TextDecoder(),strict=new TextDecoder('utf-8',{fatal:true});let tail=new Uint8Array();
  const add=(value,file)=>{
    try{
      const path=safePath(value),parts=path.split('/');
      if(parts.length<2||parts.some(part=>/^zones$/i.test(part)))return;
      const folder=file?parts.slice(0,-1).join('/'):path;
      folders.add(folder);if(file)files.add(path);
    }catch{/* A stored string must be a safe campaign-relative path. */}
  };
  return {folders,files,scan(raw){
    const joined=new Uint8Array(tail.length+raw.length);joined.set(tail);joined.set(raw,tail.length);
    const text=decoder.decode(joined);
    const pattern=/(?<![\\/\w:])(?:Blizzard|FKManualSaves|CustomSaves)[\\/][^\\/\x00-\x1f]{1,255}[\\/][^\\/\x00-\x1f]{1,255}\.w3z/gi;
    for(const match of text.matchAll(pattern))add(match[0],true);
    // Type-4/u64 UTF-8 records carry the actual manual backup directory, even
    // when it differs from the checkpoint filename. Folder-only paths are
    // discovery hints; they do not invent missing snapshot files.
    const view=new DataView(joined.buffer);
    for(let i=0;i+12<=joined.length;i++){
      if(joined[i]!==4||view.getUint32(i,true)!==4||view.getUint32(i+8,true)!==0)continue;
      const length=view.getUint32(i+4,true);
      if(!length||length>1024||i+12+length>joined.length)continue;
      let value;try{value=strict.decode(joined.subarray(i+12,i+12+length));}catch{continue;}
      if(/\.w3z$/i.test(value))add(value,true);
      else if(/^(?:Blizzard|FKManualSaves|CustomSaves)[\\/]/i.test(value))add(value,false);
    }
    tail=joined.slice(-1048);
  }};
}

export function checkpointBundle(inventory,path,references=[],requiredFiles=[]){
  const main=inventory.find(entry=>entry.path===path);
  if(!main)throw Error('This save is no longer in the selected folder.');
  const parent=path.slice(0,path.lastIndexOf('/')+1),stem=path.split('/').at(-1).slice(0,-4);
  const validFolder=folder=>{const normalized=safePath(folder);if(normalized.split('/').some(part=>/^zones$/i.test(part)))return null;return normalized;};
  const available=folder=>inventory.some(entry=>entry.path.toLowerCase().startsWith(`${parent}${folder}/`.toLowerCase()));
  const original=stem.replace(/_repaired(?:_\d+)?$/i,'');
  const referencesByCase=new Map();
  for(const reference of references){const normalized=validFolder(reference);if(normalized)referencesByCase.set(normalized.toLowerCase(),normalized);}
  const candidates=Array.from(referencesByCase.values());
  if(candidates.length>1)throw Error('This save names multiple companion directories; its own folder cannot be identified safely.');
  // Stored paths are authoritative. A filename match is only a legacy fallback
  // when the selected main save has no stored companion path at all.
  const folder=candidates[0]||(available(`Blizzard/${stem}`)?`Blizzard/${stem}`:available(`Blizzard/${original}`)?`Blizzard/${original}`:null);
  const prefix=folder?`${parent}${folder}/`.toLowerCase():null;
  const companions=prefix?inventory.filter(entry=>entry.path.toLowerCase().startsWith(prefix)):[];
  const knownPaths=new Set(inventory.map(entry=>entry.path.toLowerCase()));
  // An absent same-name folder is not evidence that this save needs companions.
  // With no matching folder, disclose only folders/files named by the main save.
  const missingFolders=candidates.filter(name=>!available(name)&&Array.from(requiredFiles).some(file=>file.toLowerCase().startsWith(name.toLowerCase()+'/')));
  const missingFiles=Array.from(requiredFiles).filter(relative=>{
    const absolute=(parent+relative).toLowerCase();
    const inScope=prefix&&absolute.startsWith(prefix);
    return inScope&&!knownPaths.has(absolute);
  });
  return {entries:[main,...companions],companionFolder:folder?`${parent}${folder}`:null,
    missingFolders,missingFiles,companionCount:companions.filter(entry=>entry.path.toLowerCase().endsWith('.w3z')).length};
}

export async function resolveCheckpointBundle(inventory,path,readReferences,{maxBytes=1024**3,maxFiles=5000}={}){
  const main=inventory.find(entry=>entry.path===path);
  if(!main)throw Error('Select a save from the list.');
  const withinLimit=entries=>{if(entries.reduce((sum,entry)=>sum+entry.blob.size,0)>maxBytes)throw Error('This checkpoint and its companions exceed 1 GB. Choose another save.');if(entries.length>maxFiles)throw Error('This checkpoint contains too many files.');};
  withinLimit([main]);
  const refs=await readReferences(main);
  const bundle=checkpointBundle(inventory,path,refs.folders,refs.files);
  withinLimit(bundle.entries);
  return bundle;
}
