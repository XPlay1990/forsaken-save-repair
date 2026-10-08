import {safePath,assertUniquePaths} from './repair.mjs';

export function indexFolder(files){
  const entries=files.map(blob=>({path:safePath(blob.webkitRelativePath||blob.name),blob}));
  assertUniquePaths(entries);
  const checkpoints=entries.filter(entry=>entry.path.toLowerCase().endsWith('.w3z')&&
    !/^undeadre\d+(?:_\d+)?\.w3z$/i.test(entry.path.split('/').at(-1))&&
    !entry.path.split('/').slice(0,-1).some(part=>/^(blizzard|customsaves)$/i.test(part)));
  checkpoints.sort((a,b)=>(b.blob.lastModified||0)-(a.blob.lastModified||0)||a.path.localeCompare(b.path));
  return {entries,checkpoints:checkpoints.map(entry=>({path:entry.path,name:entry.path.split('/').at(-1).slice(0,-4),size:entry.blob.size}))};
}

// References can span compressed-block boundaries. Collect directory names,
// never rewrite the saved Lua strings or use another checkpoint's working Zones.
export function companionReferenceScanner(){
  const folders=new Set(),files=new Set();const decoder=new TextDecoder();let tail='';
  return {folders,files,scan(raw){
    const text=tail+decoder.decode(raw,{stream:true});
    const pattern=/Blizzard[\\/]([^\\/\x00-\x1f]{1,255})[\\/][a-z0-9_]+\.w3z/gi;
    for(const match of text.matchAll(pattern))if(!/^zones$/i.test(match[1])){folders.add(match[1]);files.add(match[0].replaceAll('\\','/'));}
    tail=text.slice(-1024);
  }};
}

export function checkpointBundle(inventory,path,references=[],requiredFiles=[]){
  const main=inventory.find(entry=>entry.path===path);
  if(!main)throw Error('This save is no longer in the selected folder.');
  const parent=path.slice(0,path.lastIndexOf('/')+1),stem=path.split('/').at(-1).slice(0,-4);
  const available=folder=>inventory.some(entry=>entry.path.toLowerCase().startsWith(`${parent}Blizzard/${folder}/`.toLowerCase()));
  const referenced=Array.from(references).filter(folder=>!/^zones$/i.test(folder));
  const missingFolders=referenced.filter(folder=>!available(folder));
  const knownPaths=new Set(inventory.map(entry=>entry.path.toLowerCase()));
  const missingFiles=Array.from(requiredFiles).filter(relative=>!knownPaths.has((parent+relative).toLowerCase()));
  let folders=referenced.filter(available);
  if(!referenced.length){
    // Filename association covers normal saves and earlier recovery filenames.
    const original=stem.replace(/_repaired(?:_\d+)?$/i,'');
    const folder=available(stem)?stem:available(original)?original:null;
    if(folder&&!/^zones$/i.test(folder))folders=[folder];
  }
  const prefixes=folders.map(folder=>`${parent}Blizzard/${folder}/`.toLowerCase());
  const companions=inventory.filter(entry=>prefixes.some(prefix=>entry.path.toLowerCase().startsWith(prefix)));
  return {entries:[main,...companions],missingFolders,missingFiles,companionCount:companions.filter(entry=>entry.path.toLowerCase().endsWith('.w3z')).length};
}

export async function resolveCheckpointBundle(inventory,path,readReferences,{maxBytes=1024**3,maxFiles=5000}={}){
  const main=inventory.find(entry=>entry.path===path);
  if(!main)throw Error('Select a save from the list.');
  const entries=[main],seen=new Set([path]),missingFolders=new Set(),missingFiles=new Set();let bytes=main.blob.size;
  const withinLimit=()=>{if(bytes>maxBytes)throw Error('This checkpoint and its linked companions exceed 1 GB. Choose another save.');if(entries.length>maxFiles)throw Error('This checkpoint contains too many linked files.');};
  withinLimit();
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];if(!entry.path.toLowerCase().endsWith('.w3z'))continue;
    const refs=await readReferences(entry);
    if(i!==0&&!refs.folders.size)continue;
    const bundle=checkpointBundle(inventory,path,refs.folders,refs.files);
    for(const folder of bundle.missingFolders)missingFolders.add(folder);
    for(const file of bundle.missingFiles)missingFiles.add(file);
    for(const linked of bundle.entries){if(seen.has(linked.path))continue;seen.add(linked.path);entries.push(linked);bytes+=linked.blob.size;}
    withinLimit();
  }
  return {entries,companionCount:entries.filter(entry=>entry!==main&&entry.path.toLowerCase().endsWith('.w3z')).length,missingFolders:Array.from(missingFolders),missingFiles:Array.from(missingFiles)};
}
