import test from 'node:test';
import assert from 'node:assert/strict';
import {DOWNGRADE_PROFILE as profile,PROFILE} from '../dist/profiles.mjs';
import {repairSave,inspectSave} from '../dist/repair.mjs';
import {native301Fixture} from './native301-fixture.mjs';
import {expanded} from './native-fixture.mjs';
import {repairHeroArmor} from '../dist/native-downgrade.mjs';

const heroes=[{agility:50,flatArmor:2},{agility:37,primary:1,primaryValue:63,flatArmor:8}];
test('native downgrade recalculates both hero and unit armor caches, retaining flat armor and scripts',()=>{
  const result=repairSave(native301Fixture({heroes}),{profile});
  const expected=native301Fixture({legacy:true,heroes:heroes.map(h=>({...h,coefficient:.30}))});
  assert.deepEqual(expanded(result.data),expanded(expected));
  assert.equal(result.inspection.heroArmorRepairs,2);
  assert.equal(inspectSave(result.data,{profile}).heroArmorRepairs,0);
  assert.deepEqual(repairSave(result.data,{profile}).data,result.data);
});

test('previously downgraded saves repair stale caches and leave already recalculated heroes unchanged',()=>{
  const mixed=[...heroes,{agility:82,size:344,coefficient:.30},{agility:21,size:352,primary:2,primaryValue:37}];
  const result=repairSave(native301Fixture({legacy:true,heroes:mixed}),{profile});
  const expected=native301Fixture({legacy:true,heroes:mixed.map(h=>({...h,coefficient:.30}))});
  assert.deepEqual(expanded(result.data),expanded(expected));
  assert.equal(result.inspection.heroArmorRepairs,3);
  assert.equal(inspectSave(result.data,{profile}).status,'current');
});

test('unknown cached armor rules are preserved, as are upgrades',()=>{
  const custom=[{agility:50,coefficient:.42},{agility:0,coefficient:.14},{agility:37.5,primary:1},{agility:50,speed:.8}];
  const source=native301Fixture({legacy:true,heroes:custom});
  assert.deepEqual(repairSave(source,{profile}).data,source);
  // Upgrading a 3.0.1.24342 save only changes its map checksum; hero armor stays as saved.
  const upgrade=repairSave(native301Fixture({map:profile.maps.find(row=>row.id==='undeadre02'),heroes}),{profile:PROFILE});
  assert.equal(upgrade.inspection.status,'repair');assert.equal(upgrade.inspection.heroArmorRepairs,0);
});

test('unverified hero ownership skips that hero without blocking the save',()=>{
  const raw=expanded(native301Fixture({legacy:true,heroes}));
  const key=Buffer.from([44,1,0,0,144,1,0,0]); // ability ID [300,400]
  // The constructor repeats its ID at 36/76; its owner lies immediately after the first ID.
  const at=Buffer.from(raw).indexOf(key,5000);
  assert.ok(at>0);
  raw.fill(0,at+8,at+16);
  const result=repairHeroArmor(raw);
  assert.equal(result.report.heroArmorSkipped,1);
  assert.equal(result.report.heroArmorRepairs,1);
  assert.deepEqual(result.report.heroArmorChanges.map(c=>c.abilityId),['2d01000091010000']); // the second hero, ability ID [301,401]
  // Only the two recorded 4-byte caches change.
  const changed=[];for(let i=0;i<raw.length;i++)if(raw[i]!==result.raw[i])changed.push(i);
  const [c]=result.report.heroArmorChanges,windows=[c.armorOffset,c.unitArmorOffset];
  assert.ok(changed.length>0&&changed.every(i=>windows.some(w=>i>=w&&i<w+4)));
});

test('an unrecognized native layout leaves hero armor unchanged instead of blocking',()=>{
  const raw=expanded(native301Fixture({legacy:true,heroes})),broken=raw.slice();
  const espi=Buffer.from(broken).indexOf(Buffer.from('espi'));broken.fill(0,espi,espi+4);
  const result=repairHeroArmor(broken);
  assert.equal(result.raw,broken);assert.equal(result.report.heroArmorRepairs,0);assert.equal(result.report.heroArmorLayoutUnrecognized,true);
});
