import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {unzipSync} from 'fflate';
import {PROFILE,DOWNGRADE_PROFILE as profile} from '../dist/profiles.mjs';
import {inspectSave,repairSave} from '../dist/repair.mjs';
import {native301Fixture} from './native301-fixture.mjs';
import {parseEris} from '../dist/native-downgrade.mjs';
import {expanded} from './native-fixture.mjs';
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const make=(path,data)=>{const file=new File([data],path.split('/').at(-1));Object.defineProperty(file,'webkitRelativePath',{value:path});return file;};

test('3.0.1 saves convert to the exact 3.0.0 layout, with or without pending trigger waits',()=>{
  for(const map of profile.maps){
    for(const waits of [[],[2],[147,143]]){
      const source=native301Fixture({map,waits}),expected=native301Fixture({map,waits,legacy:true});
      const inspection=inspectSave(source,{profile});
      assert.equal(inspection.status,'repair',map.id);assert.equal(inspection.nativeDowngrade.pendingWaits,waits.length);
      const result=repairSave(source,{profile});
      assert.equal(hash(expanded(result.data)),hash(expanded(expected)),`${map.id} waits=${waits}`);
      assert.equal(new DataView(result.data.buffer).getUint16(56,true),7000);
      assert.equal(result.nativeDowngrade.units,1);assert.equal(result.nativeDowngrade.removedReferences,18);
      assert.equal(inspectSave(result.data,{profile}).status,'current');
      assert.equal(hash(repairSave(result.data,{profile}).data),hash(result.data),'A converted save is already current');
    }
  }
});

test('projectiles of any missile model drop the 3.0.1 field and the 3.0.1-only buff',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre01_06');
  const missiles=['Abilities'+String.fromCharCode(92)+'Weapons'+String.fromCharCode(92)+'Arrow'+String.fromCharCode(92)+'ArrowMissile.mdl',
    ['Abilities','Spells','Items','WandOfNeutralization','NeutralizationMissile.mdl'].join(String.fromCharCode(92))];
  const result=repairSave(native301Fixture({map,missiles,waits:[]}),{profile});
  assert.equal(result.nativeDowngrade.projectilesReversed,2);
  assert.equal(hash(expanded(result.data)),hash(expanded(native301Fixture({map,missiles,waits:[],legacy:true}))));
});

test('a downgraded save can be upgraded again by the existing 3.0.1 repair',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre02_06');
  const downgraded=repairSave(native301Fixture({map}),{profile}).data;
  const upgraded=repairSave(downgraded,{profile:PROFILE});
  assert.equal(upgraded.inspection.status,'repair');
  assert.equal(inspectSave(upgraded.data,{profile:PROFILE}).checksum,PROFILE.maps.find(row=>row.id===map.id).current);
  assert.equal(new DataView(upgraded.data.buffer).getUint16(56,true),7000,'Upgrades keep the save build; 3.0.1 re-saves it natively');
});

test('scripts from 3.0.1 maps get 3.0.0 fallbacks for the natives they call',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre02');
  const result=repairSave(native301Fixture({map,scriptUses:['BlzRemoveEffect','BlzUnitHeal']}),{profile});
  assert.deepEqual(result.nativeDowngrade.scriptFallbacks.map(row=>[row.native,row.replacement]),[['BlzRemoveEffect','DestroyEffect'],['BlzUnitHeal','DoNothing']]);
  assert.equal(result.nativeDowngrade.removedUnusedGlobals.length,7);
  assert.match(result.inspection.reason,/BlzRemoveEffect → DestroyEffect/);
  // Read the converted script graph back: the names stay, bound to 3.0.0 behaviour.
  const raw=expanded(result.data);
  const graph=parseEris(raw,Buffer.from(raw).indexOf(Buffer.from('ERIS')));
  const text=node=>new TextDecoder().decode(raw.subarray(node.text,node.text+node.size));
  const table=node=>new Map(node.pairs.map(([k,v])=>[text(k),v]));
  const globals=table(table(table(graph.refs[1]).get('_LOADED')).get('_G'));
  assert.equal(text(globals.get('BlzRemoveEffect').child),'DestroyEffect');
  assert.equal(globals.get('BlzUnitHeal'),globals.get('DoNothing'));
  assert.equal(globals.has('BlzGetHUDScale'),false);
  assert.equal(inspectSave(result.data,{profile}).status,'current');
});

test('saves whose scripts use 3.0.1-only natives without a fallback, or with unknown checksums, are blocked',()=>{
  const map=profile.maps.find(row=>row.id==='undeadre02_06');
  assert.throws(()=>repairSave(native301Fixture({map,scriptUses:'BlzResetUnitTalents'}),{profile}),/scripts use BlzResetUnitTalents, which exists only in 3.0.1 and has no 3.0.0 replacement/);
  assert.throws(()=>repairSave(native301Fixture({map,checksum:'11223344'}),{profile}),/unverified source map revision/);
  assert.throws(()=>repairSave(native301Fixture({map,checksum:profile.maps.find(row=>row.id===map.id).current}),{profile}),/must use the 3.0.1 map checksum/);
});

test('worker downgrades a 3.0.1 checkpoint and companions as <name>_downgraded_3.0.0',async()=>{
  const messages=[];globalThis.self={postMessage:message=>messages.push(message)};
  try{
    await import('../dist/worker.mjs?native-downgrade');
    const map=profile.maps.find(row=>row.id==='undeadre02_06'),companionMap=profile.maps.find(row=>row.id==='undeadre02');
    const main=native301Fixture({map,waits:[2]}),companion=native301Fixture({map:companionMap,waits:[]});
    await self.onmessage({data:{type:'listFolder',profileId:profile.id,files:[make('ForsakenKingdom/Slot.w3z',main),make('ForsakenKingdom/FKManualSaves/Slot/UndeadRE02.w3z',companion)]}});
    await self.onmessage({data:{type:'checkpoint',path:'ForsakenKingdom/Slot.w3z'}});
    assert.equal(messages.at(-1).type,'analyzed',messages.at(-1).message);
    await self.onmessage({data:{type:'export'}});
    assert.equal(messages.at(-1).type,'exported',messages.at(-1).message);
    const zip=unzipSync(new Uint8Array(await messages.at(-1).blob.arrayBuffer()));
    assert.deepEqual(zip['Slot_downgraded_3.0.0.w3z'],repairSave(main,{profile}).data);
    const report=JSON.parse(new TextDecoder().decode(zip['forsaken-repair-report.json']));
    assert.equal(report.repairMode,'native-3.0.1-downgrade');
    assert.ok(report.changed.every(row=>row.nativeDowngrade?.units===1));
  }finally{delete globalThis.self;}
});
