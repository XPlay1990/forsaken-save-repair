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
  const available=folder=>!/^zones$/i.test(folder)&&inventory.some(entry=>entry.path.toLowerCase().startsWith(`${parent}Blizzard/${folder}/`.toLowerCase()));
  const original=stem.replace(/_repaired(?:_\d+)?$/i,'');
  let folder=available(stem)?stem:available(original)?original:null;
  // Read saved paths only as a fallback for an arbitrarily renamed main save.
  // Strings inside companion snapshots are not evidence of live dependencies.
  if(!folder){
    const candidates=Array.from(new Map(Array.from(references).filter(available).map(folder=>[folder.toLowerCase(),folder])).values());
    if(candidates.length>1)throw Error('Could not identify one companion folder for this renamed save.');
    folder=candidates[0]||null;
  }
  const prefix=folder?`${parent}Blizzard/${folder}/`.toLowerCase():null;
  const companions=prefix?inventory.filter(entry=>entry.path.toLowerCase().startsWith(prefix)):[];
  const knownPaths=new Set(inventory.map(entry=>entry.path.toLowerCase()));
  const missingFiles=prefix?Array.from(requiredFiles).filter(relative=>(parent+relative).toLowerCase().startsWith(prefix)&&!knownPaths.has((parent+relative).toLowerCase())):[];
  return {entries:[main,...companions],companionFolder:folder?`${parent}Blizzard/${folder}`:null,
    missingFolders:folder?[]:[original],missingFiles,companionCount:companions.filter(entry=>entry.path.toLowerCase().endsWith('.w3z')).length};
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
