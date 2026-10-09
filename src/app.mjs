const $=id=>document.getElementById(id);
let worker,stats,downloadURL,reportURL,busy=false,checkpoints=[],needsAck=false,selectedFiles=[];
const labels={repair:'Repair',current:'Current',unsupported:'Unchanged',blocked:'Blocked'};
const downgrade=()=>$('target-version').value==='forsaken-all-maps-to-300';
function refreshTarget(){
  const down=downgrade();labels.repair=down?'Downgrade':'Repair';
  $('target-note').textContent=down?'Restore saves repaired for 3.0.1. In-game 3.0.1 saves are not supported yet.':'Repair older saves for Warcraft III 3.0.1.';
  $('tested-act-one').hidden=down;
  $('tested-act-two-title').textContent=down?'Downgrade testing':'Tested — Act Two';
  $('tested-act-two-copy').textContent=down?'Scarlet Monastery: a reversed repair loaded successfully.':"Undercity (starting map), Scarlet Monastery and Dawn's Watch.";
  $('target-limitations').textContent=`${down?'For saves converted to 3.0.1 without re-saving in the game. Saves re-saved by 3.0.1 are currently blocked. Targets restored Warcraft III 3.0.0.':'For saves from before patch 3.0.1, targeting Warcraft III 3.0.1.24342.'} A successful test does not guarantee every checkpoint on that map will work. Other patches are unsupported.`;
}
function startWorker(){worker?.terminate();worker=new Worker(new URL('./worker.mjs',import.meta.url),{type:'module'});worker.onmessage=onMessage;worker.onerror=()=>fail('Processing stopped. Try a smaller checkpoint.');}
function setBusy(value){busy=value;$('target-version').disabled=value;$('folder-button').disabled=value;$('another-save').disabled=value;$('clear').hidden=value;$('progress-area').hidden=!value;$('cancel').hidden=!value;updateExport();}
function updateExport(){const eligible=stats&&stats.repair+stats.current>0&&!stats.blocked&&stats.checkpointSupported;$('export').disabled=busy||!eligible||(needsAck&&!$('missing-ack').checked);$('report').disabled=busy||!stats;}
function revokeDownload(){if(downloadURL)URL.revokeObjectURL(downloadURL);if(reportURL)URL.revokeObjectURL(reportURL);downloadURL=null;reportURL=null;}
function resetResults(){stats=null;needsAck=false;revokeDownload();for(const id of ['error','results','success','progress-area'])$(id).hidden=true;$('file-list').replaceChildren();$('missing-ack').checked=false;$('export').hidden=false;updateExport();}
function clear(){worker?.terminate();worker=null;busy=false;checkpoints=[];selectedFiles=[];resetResults();$('save-picker').hidden=true;$('another-save').hidden=true;$('clear').hidden=true;$('drop-zone').hidden=false;$('bundle-location').hidden=false;$('folder-input').value='';$('save-search').value='';$('folder-button').disabled=false;$('target-version').disabled=false;$('step-label').textContent='Choose your folder';$('step-number').textContent='01';}
function fail(message){$('error').textContent=message;$('error').hidden=false;setBusy(false);$('clear').hidden=false;$('another-save').hidden=!checkpoints.length;}
function addRow(row){const li=document.createElement('li');const name=document.createElement('span');name.className='file-path';name.textContent=row.path;const tag=document.createElement('span');tag.className=`file-tag ${row.status}`;tag.textContent=labels[row.status];const reason=document.createElement('span');reason.className='file-reason';reason.textContent=row.reason;li.append(name,tag,reason);$('file-list').append(li);}
function renderChoices(){const query=$('save-search').value.toLowerCase();$('checkpoint-list').replaceChildren();for(const save of checkpoints.filter(save=>save.name.toLowerCase().includes(query))){const li=document.createElement('li'),button=document.createElement('button'),name=document.createElement('span'),size=document.createElement('small');button.type='button';button.className='checkpoint-choice';button.dataset.path=save.path;name.textContent=save.name;size.textContent=`${(save.size/1048576).toFixed(1)} MB →`;button.append(name,size);button.onclick=()=>chooseCheckpoint(save.path);li.append(button);$('checkpoint-list').append(li);}$('no-search-results').hidden=$('checkpoint-list').children.length>0;}
function showChoices(){resetResults();$('save-picker').hidden=false;$('another-save').hidden=true;$('step-label').textContent='Choose a save';$('step-number').textContent='02';$('clear').hidden=false;renderChoices();}
function chooseCheckpoint(path){if(busy)return;resetResults();$('save-picker').hidden=true;$('another-save').hidden=true;$('step-label').textContent=checkpoints.find(save=>save.path===path)?.name||'Your save';$('step-number').textContent='03';setBusy(true);$('progress-message').textContent='Finding companion saves…';$('progress').value=0;worker.postMessage({type:'checkpoint',path});}
function renderSummary(data){stats=data.summary;$('results').hidden=false;$('file-count').textContent=`${(data.bytes/1048576).toFixed(1)} MB`;$('checked-count').textContent=`(${data.rows.length} saves)`;$('stats').textContent=data.selection.companionCount?`1 checkpoint + ${data.selection.companionCount} companion save${data.selection.companionCount===1?'':'s'}`:'1 checkpoint';
  $('unsupported-note').hidden=!stats.unsupported;$('unsupported-note').textContent=`${stats.unsupported} save(s) reference unrecognized maps and will be included unchanged.`;
  needsAck=data.selection.missingFolders.length>0||data.selection.missingFiles.length>0;
  $('missing-note').hidden=!needsAck;$('missing-ack-wrap').hidden=!needsAck;$('missing-note').textContent='Referenced companion files were not found. Map travel may fail.';
  setBusy(false);$('another-save').hidden=!checkpoints.length;
  if(stats.blocked)fail('This checkpoint cannot be converted. See file details.');
  else if(!stats.checkpointSupported||!(stats.repair+stats.current))fail('This save is not supported yet. Choose another checkpoint.');
  $('export').textContent=stats.repair?(downgrade()?'Downgrade & download ↓':'Repair & download ↓'):'Download checked save ↓';updateExport();
}
function onMessage({data}){
  if(data.type==='progress'){$('progress-message').textContent=data.message;$('progress').value=data.value;}
  else if(data.type==='checkpoints'){checkpoints=data.checkpoints;setBusy(false);showChoices();}
  else if(data.type==='row')addRow(data.row);
  else if(data.type==='analyzed')renderSummary(data);
  else if(data.type==='error')fail(data.message);
  else if(data.type==='reported'){setBusy(false);if(reportURL)URL.revokeObjectURL(reportURL);reportURL=URL.createObjectURL(data.blob);const link=document.createElement('a');link.href=reportURL;link.download=data.filename;link.hidden=true;document.body.append(link);link.click();link.remove();}
  else if(data.type==='exported'){setBusy(false);revokeDownload();downloadURL=URL.createObjectURL(data.blob);$('download').href=downloadURL;$('download').download=data.filename;$('success-copy').textContent='Download started. Your original files are unchanged.';$('success').hidden=false;$('export').hidden=true;$('download').click();}
}
function selectFolder(files){if(busy||!files.length)return;const selected=Array.from(files);clear();selectedFiles=selected;$('drop-zone').hidden=true;$('bundle-location').hidden=true;setBusy(true);$('progress-message').textContent='Listing your saves…';startWorker();worker.postMessage({type:'listFolder',files:selected,profileId:$('target-version').value});}
$('folder-button').onclick=()=>$('folder-input').click();$('folder-input').onchange=event=>selectFolder(event.target.files);$('clear').onclick=clear;$('cancel').onclick=clear;$('another-save').onclick=showChoices;$('save-search').oninput=renderChoices;$('missing-ack').onchange=updateExport;$('export').onclick=()=>{if($('export').disabled)return;$('error').hidden=true;setBusy(true);worker.postMessage({type:'export'});};
window.addEventListener('beforeunload',()=>{worker?.terminate();revokeDownload();});
$('report').onclick=()=>{if($('report').disabled)return;setBusy(true);worker.postMessage({type:'report'});};
$('target-version').onchange=()=>{refreshTarget();if(selectedFiles.length)selectFolder(selectedFiles);};
refreshTarget();
