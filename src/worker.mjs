import {Unzip, UnzipInflate, Zip, ZipPassThrough} from './vendor/fflate.mjs';
import {inspectSave,repairSave,safePath,assertUniquePaths,crc32State} from './repair.mjs';
import {PROFILE} from './profiles.mjs';
import {readZipIndex} from './zip-index.mjs';
import {planBundleNames} from './bundle-names.mjs';

let entries=[];let analysis=[];
const MAX_BYTES=1024*1024*1024,MAX_FILES=5000,CHUNK=1024*1024;
const send=(type,data={})=>self.postMessage({type,...data});
const ensure=(ok,message)=>{if(!ok)throw Error(message);};

async function unpack(file){
  ensure(file.size<=MAX_BYTES,'This ZIP is larger than the 1 GB browser limit.');
  const index=await readZipIndex(file,MAX_BYTES);
  const found=[];let total=0;let failure;let active=0;
  const unzip=new Unzip(entry=>{
    if(entry.name.endsWith('/'))return;
    const path=safePath(entry.name);
    const expected=index.get(path.toLowerCase());ensure(expected&&expected.path===path,'The ZIP directory and file entries disagree.');
    ensure(found.length<MAX_FILES,'The bundle contains too many files.');
    if(entry.originalSize!==undefined)ensure(entry.originalSize<=MAX_BYTES,'A ZIP entry is too large.');
    active++;const chunks=[];let crc=0xffffffff,entrySize=0;const item={path,blob:null};found.push(item);
    entry.ondata=(error,chunk,final)=>{
      if(error){failure=error;return;}
      total+=chunk.length;ensure(total<=MAX_BYTES,'The expanded ZIP is larger than the 1 GB browser limit.');
      entrySize+=chunk.length;ensure(entrySize<=expected.size,'A ZIP entry expands beyond its declared size.');crc=crc32State(chunk,crc);
      chunks.push(chunk);
      if(final){ensure(entrySize===expected.size&&((crc^0xffffffff)>>>0)===expected.crc,`ZIP integrity check failed: ${path}`);item.blob=new Blob(chunks);active--;}
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  for(let offset=0;offset<file.size;offset+=CHUNK){
    const chunk=new Uint8Array(await file.slice(offset,offset+CHUNK).arrayBuffer());
    unzip.push(chunk,offset+CHUNK>=file.size);
    if(failure)throw failure;
    send('progress',{message:'Opening the ZIP locally…',value:Math.min(8,8*(offset+chunk.length)/file.size)});
  }
  ensure(active===0&&found.every(x=>x.blob)&&found.length===index.size,'The ZIP is incomplete or uses unsupported encryption.');
  return found;
}
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
    missing:maps.filter(x=>!x.repair&&!x.current).map(x=>x.name)};
}
async function analyze(files){
  entries=[];analysis=[];
  if(files.length===1&&files[0].name.toLowerCase().endsWith('.zip'))entries=await unpack(files[0]);
  else entries=files.map(file=>({path:safePath(file.webkitRelativePath||file.name),blob:file}));
  ensure(entries.length>0&&entries.length<=MAX_FILES,'Select a campaign folder or ZIP containing save files.');
  ensure(entries.reduce((sum,x)=>sum+x.blob.size,0)<=MAX_BYTES,'The selected bundle is larger than the 1 GB browser limit.');
  assertUniquePaths(entries);
  const saves=entries.filter(x=>x.path.toLowerCase().endsWith('.w3z'));
  ensure(saves.length>0,'No .w3z save files were found in this bundle.');
  for(let i=0;i<saves.length;i++){
    const entry=saves[i];
    send('progress',{message:`Checking ${entry.path}`,value:8+92*i/saves.length});
    try{
      const result=inspectSave(new Uint8Array(await entry.blob.arrayBuffer()));
      analysis.push(publicResult(result,entry.path,entry.blob.size));
    }catch(error){analysis.push({path:entry.path,size:entry.blob.size,status:'blocked',reason:error.message});}
    send('row',{row:analysis.at(-1)});
  }
  const {renamed}=planBundleNames(entries,analysis);
  send('analyzed',{rows:analysis,renamed,summary:summary(analysis),files:entries.length,bytes:entries.reduce((sum,x)=>sum+x.blob.size,0)});
}
async function exportBundle(){
  const stats=summary(analysis);
  ensure(entries.length>0&&!stats.blocked,'The bundle contains an invalid or unverified save; export stopped.');
  ensure(stats.repair+stats.current>0,'No supported Act One saves were selected.');
  const {paths,renamed}=planBundleNames(entries,analysis);
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
  const metadata={profile:PROFILE.id,target:`${PROFILE.to}.${PROFILE.build}`,scope:'Act One only',
    created:new Date().toISOString(),changed:changes,renamed,unchangedUnsupported:analysis.filter(x=>x.status==='unsupported').map(x=>({file:x.path,outputFile:paths.get(x.path)})),
    missingMaps:stats.missing,verification:'File-level checks passed. Test loading and travel in Warcraft III, then save again under a new name.',
    privacy:'All processing happened in this browser. No files were sent to a server.'};
  let reportName='forsaken-repair-report.json';
  while(Array.from(paths.values()).some(path=>path.toLowerCase()===reportName.toLowerCase()))reportName='_'+reportName;
  const report=new ZipPassThrough(reportName);report.mtime=new Date('2026-10-08T00:00:00Z');zip.add(report);
  report.push(new TextEncoder().encode(JSON.stringify(metadata,null,2)),true);zip.end();
  if(zipError)throw zipError;
  send('exported',{blob:new Blob(chunks,{type:'application/zip'}),changes:changes.length,renamed:renamed.length});
}
self.onmessage=async event=>{
  try{
    if(event.data.type==='analyze')await analyze(event.data.files);
    else if(event.data.type==='export')await exportBundle();
    else throw Error('Unknown operation.');
  }catch(error){send('error',{message:error.message||String(error)});}
};
