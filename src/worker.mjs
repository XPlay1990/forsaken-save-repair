import {Zip, ZipPassThrough} from './vendor/fflate.mjs';
import {inspectSave,repairSave,assertUniquePaths} from './repair.mjs';
import {PROFILE} from './profiles.mjs';
import {planBundleNames} from './bundle-names.mjs';
import {indexFolder,resolveCheckpointBundle,companionReferenceScanner} from './checkpoint-bundle.mjs';

let entries=[];let analysis=[];let inventory=[];let selection=null;
const MAX_BYTES=1024*1024*1024,MAX_FILES=5000,CHUNK=1024*1024;
const send=(type,data={})=>self.postMessage({type,...data});
const ensure=(ok,message)=>{if(!ok)throw Error(message);};

function publicResult(result,path,size){
  const {map,mapId,mapName,checksum,targetChecksum,status,reason,build,blocks}=result;
  return {path,size,map,mapId,mapName,checksum,targetChecksum,status,reason,build,blocks};
}
function summary(rows){
  const maps=PROFILE.maps.map(map=>({id:map.id,name:map.name,
    repair:rows.filter(x=>x.mapId===map.id&&x.status==='repair').length,
    current:rows.filter(x=>x.mapId===map.id&&x.status==='current').length}));
  return {maps,repair:rows.filter(x=>x.status==='repair').length,current:rows.filter(x=>x.status==='current').length,
    unsupported:rows.filter(x=>x.status==='unsupported').length,blocked:rows.filter(x=>x.status==='blocked').length,
    missing:maps.filter(x=>!x.repair&&!x.current).map(x=>x.name),
    checkpointSupported:!!selection&&rows.some(row=>row.path===selection.path&&['repair','current'].includes(row.status))};
}
async function listFolder(files){
  const indexed=indexFolder(files);inventory=indexed.entries;entries=[];analysis=[];selection=null;
  ensure(indexed.checkpoints.length>0,'Choose the ForsakenKingdom folder containing your main .w3z saves.');
  send('checkpoints',{checkpoints:indexed.checkpoints});
}
async function analyzeCheckpoint(path){
  entries=[];analysis=[];selection=null;
  const main=inventory.find(entry=>entry.path===path);ensure(main,'Select a save from the list.');
  ensure(main.blob.size<=MAX_BYTES,'This individual save exceeds 1 GB.');
  send('progress',{message:'Finding companion saves…',value:0});
  const cached=new Map();
  const bundle=await resolveCheckpointBundle(inventory,path,async entry=>{
    send('progress',{message:`Checking ${entry.path.split('/').at(-1)}`,value:0});
    const scanner=companionReferenceScanner();let inspection,inspectionError;
    try{inspection=inspectSave(new Uint8Array(await entry.blob.arrayBuffer()),{onExpandedBlock:raw=>scanner.scan(raw)});}
    catch(error){inspectionError=error;}
    // Retain only public metadata; expanded blocks can be released before the next file.
    cached.set(entry.path,inspection?{inspection:publicResult(inspection,entry.path,entry.blob.size)}:{inspectionError});
    return scanner;
  },{maxBytes:MAX_BYTES,maxFiles:MAX_FILES});
  selection={path,companionFolder:bundle.companionFolder,companionCount:bundle.companionCount,missingFolders:bundle.missingFolders,missingFiles:bundle.missingFiles};
  entries=bundle.entries;
  await analyzeEntries(cached);
}
async function analyzeEntries(cached=new Map()){
  ensure(entries.length>0&&entries.length<=MAX_FILES,'This checkpoint contains too many files.');
  ensure(entries.reduce((sum,x)=>sum+x.blob.size,0)<=MAX_BYTES,'This checkpoint and its companions exceed 1 GB. Choose another save.');
  assertUniquePaths(entries);
  const saves=entries.filter(x=>x.path.toLowerCase().endsWith('.w3z'));
  ensure(saves.length>0,'No .w3z save files were found in this bundle.');
  for(let i=0;i<saves.length;i++){
    const entry=saves[i];
    send('progress',{message:`Checking ${entry.path}`,value:8+92*i/saves.length});
    try{
      const stored=cached.get(entry.path);
      if(stored?.inspectionError)throw stored.inspectionError;
      const result=stored?.inspection||inspectSave(new Uint8Array(await entry.blob.arrayBuffer()));
      analysis.push(publicResult(result,entry.path,entry.blob.size));
    }catch(error){analysis.push({path:entry.path,size:entry.blob.size,status:'blocked',reason:error.message});}
    send('row',{row:analysis.at(-1)});
  }
  const {renamed}=planBundleNames(entries,analysis,{reservedPaths:inventory.map(entry=>entry.path)});
  send('analyzed',{rows:analysis,renamed,selection,summary:summary(analysis),files:entries.length,bytes:entries.reduce((sum,x)=>sum+x.blob.size,0)});
}
async function exportBundle(){
  const stats=summary(analysis);
  ensure(selection&&entries.length>0&&!stats.blocked,'The bundle contains an invalid or unverified save; export stopped.');
  ensure(stats.repair+stats.current>0,'No supported Act One saves were selected.');
  ensure(stats.checkpointSupported,'This main save is not supported yet. Choose an Act One checkpoint.');
  const {paths,renamed}=planBundleNames(entries,analysis,{reservedPaths:inventory.map(entry=>entry.path)});
  {
    // Folder-picker paths include the chosen root; export its contents so the
    // user can copy the ZIP straight into the existing campaign directory.
    const prefix=selection.path.slice(0,selection.path.lastIndexOf('/')+1);
    for(const [source,output] of paths){ensure(output.startsWith(prefix),'A companion is outside this checkpoint directory.');paths.set(source,output.slice(prefix.length));}
    for(const item of renamed)item.to=paths.get(item.from);
  }
  const chunks=[];let zipError;
  const zip=new Zip((error,data,final)=>{if(error)zipError=error;else chunks.push(data);});
  const changes=[];
  for(let i=0;i<entries.length;i++){
    const entry=entries[i];let blob=entry.blob;
    send('progress',{message:`Preparing ${entry.path}`,value:100*i/entries.length});
    const row=analysis.find(x=>x.path===entry.path);
    if(row?.status==='repair'){
      const result=repairSave(new Uint8Array(await blob.arrayBuffer()));
      ensure(result.inspection.checksum===row.checksum,'A save changed since inspection.');
      blob=new Blob([result.data]);
      changes.push({file:entry.path,outputFile:paths.get(entry.path),map:row.mapName,from:row.checksum,to:row.targetChecksum,
        changedPayloadOffsets:result.changedOffsets,buildPreserved:result.inspection.build,checks:'Passed: container checksums, identity round-trip, untouched compressed blocks and save build.'});
    }
    const zipped=new ZipPassThrough(paths.get(entry.path));
    zipped.mtime=new Date('2026-10-08T00:00:00Z');zip.add(zipped);
    for(let offset=0;offset<blob.size;offset+=CHUNK){
      zipped.push(new Uint8Array(await blob.slice(offset,offset+CHUNK).arrayBuffer()),offset+CHUNK>=blob.size);
      if(zipError)throw zipError;
    }
    if(blob.size===0)zipped.push(new Uint8Array(),true);
  }
  const metadata={profile:PROFILE.id,target:`${PROFILE.to}.${PROFILE.build}`,scope:'Act One only',repairMode:'identity-only',folderPathsPreserved:true,
    created:new Date().toISOString(),checkpoint:selection,changed:changes,renamed,unchangedUnsupported:analysis.filter(x=>x.status==='unsupported').map(x=>({file:x.path,outputFile:paths.get(x.path)})),
    missingMaps:stats.missing,verification:'File-level checks passed. Test loading and travel in Warcraft III, then save again under a new name.',
    privacy:'All processing happened in this browser. No files were sent to a server.'};
  let reportName='forsaken-repair-report.json';
  while(Array.from(paths.values()).some(path=>path.toLowerCase()===reportName.toLowerCase()))reportName='_'+reportName;
  const report=new ZipPassThrough(reportName);report.mtime=new Date('2026-10-08T00:00:00Z');zip.add(report);
  report.push(new TextEncoder().encode(JSON.stringify(metadata,null,2)),true);zip.end();
  if(zipError)throw zipError;
  send('exported',{blob:new Blob(chunks,{type:'application/zip'}),changes:changes.length,renamed:renamed.length,filename:paths.get(selection.path).replace(/\.w3z$/i,'-bundle.zip')});
}
self.onmessage=async event=>{
  try{
    if(event.data.type==='listFolder')await listFolder(event.data.files);
    else if(event.data.type==='checkpoint')await analyzeCheckpoint(event.data.path);
    else if(event.data.type==='export')await exportBundle();
    else throw Error('Unknown operation.');
  }catch(error){send('error',{message:error.message||String(error)});}
};
