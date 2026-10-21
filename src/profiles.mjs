import {MAPS,mapByPath,patch} from './map-versions.mjs';

// A conversion profile retargets saves from earlier patches' map checksums to one patch's.
// Both directions are derived from the per-patch table in map-versions.mjs. Maps without a
// checksum for the target patch are left out (their saves are copied unchanged).
// old: the first source patch's checksum; known: every recognized source checksum.
function targets(from,to,tested,order=[]){
  const sorted=[...order.map(id=>MAPS.find(map=>map.id===id)),...MAPS.filter(map=>!order.includes(map.id))];
  return Object.freeze(sorted.filter(map=>map.checksums[to]).map(map=>Object.freeze({id:map.id,mapPath:map.mapPath,
    name:map.id==='undeadre01'?'Undercity / Trade Quarter':map.name,
    old:map.checksums[from[0]],known:Object.freeze(from.map(version=>map.checksums[version]).filter(Boolean)),
    current:map.checksums[to],checksums:map.checksums,
    donorMatched:to==='3.0.0'?map.evidence['3.0.0'].originalSaveMatched:!!map.evidence[to]?.donorSaveMatched,
    gameTested:!!map.gameTested[tested]})));
}
const common={gameIdentifier:0x57335850,gameVersion:10200};

// Upgrade: saves from 3.0.0 and the first 3.0.1 release (24342) to the re-released 3.0.1.24371.
// Any non-target checksum is replaced: the serialization build does not identify the source patch.
// Game tests are tracked per target build (gameTested['upgrade-3.0.1.24371']).
export const PROFILE = Object.freeze({
  ...common,id:'forsaken-all-maps-to-301',name:'Forsaken Kingdom · Upgrade',
  from:'3.0.0 / 3.0.1.24342',to:'3.0.1.24371',build:patch('3.0.1.24371').executable.split('.').at(-1),
  direction:'upgrade',enabled:true,experimental:true,strictSource:false,serializationBuilds:[7000,7003],
  sourcePolicy:'Validated campaign save format; every non-target checksum is replaced with the 3.0.1.24371 target. Saves of 3.0.1.24342 and 3.0.0 need only the new map checksum, as the save format (7003) is unchanged; Deathseeker projectiles of old saves are migrated as before. Source patch cannot be inferred from the serialization build.',
  verification:'All 20 targets derived from the installed 3.0.1.24371 archives with the same routine as for 3.0.1.24342; the three saves 3.0.1.24371 wrote (Act One and Act Two Undercity, Act Three Capital City Ruins) match exactly. Player-tested on 3.0.1.24371: a 3.0.1.24342 Act Two Undercity save and 3.0.0 Act One and Act Two Undercity saves load after conversion. Other maps, travel and resaving remain unconfirmed.',
  maps:targets(['3.0.0','3.0.1'],'3.0.1.24371','upgrade-3.0.1.24371',['undeadre01','undeadre02','undeadre03a'])
});
// Downgrade: 3.0.1 saves, including ones written by the 3.0.1 game (build 7003), to restored 3.0.0.
export const DOWNGRADE_PROFILE = Object.freeze({
  ...common,id:'forsaken-all-maps-to-300',name:'Forsaken Kingdom · Downgrade',
  from:'3.0.1',to:'3.0.0',build:patch('3.0.0').executable.split('.').at(-1),
  direction:'downgrade',enabled:true,experimental:true,strictSource:true,serializationBuilds:[7000],nativeBuilds:[7003],
  sourcePolicy:'Only the verified 3.0.1 or restored 3.0.0 map checksum is accepted. Website repairs (build 7000) keep their build and saved scripts; the exact Deathseeker native layout is reversed. Stale hero armor caches matching the independently saved Agility contribution are recalculated for 3.0.0 in both save builds; already corrected and unknown profiles are preserved. Saves written by 3.0.1 (build 7003) additionally convert the 3.0.1 unit and camera fields, map 18 renamed natives back to their 3.0.0 names and remove unused 3.0.1-only native bindings. Calls with known replacements use reported fallbacks; other 3.0.1-only script calls are blocked.',
  verification:'All 20 downgrade targets extracted from authenticated installed rollback archives (content manifest 3.0.0.24248; running executable 3.0.0.24268); nine match original save controls. Reversing a repaired Scarlet Monastery (4) produced a byte-identical original that loaded in the restored game. Six Scarlet Monastery checkpoints saved by 3.0.1, from the start through the later boss state, were converted, loaded, re-saved and reloaded in 3.0.0. A renamed Cathedral bundle with its Act One zone snapshots (including travel) and an Act One progress save also worked. Experimental: other maps remain unconfirmed, and a Cathedral save made just before the boss transition loads with missing models.',
  maps:targets(['3.0.1'],'3.0.0','downgrade')
});
export const PROFILES=Object.freeze([PROFILE,DOWNGRADE_PROFILE]);
export function conversionProfile(id){return PROFILES.find(profile=>profile.id===id);}
export function mapProfile(path,profile=PROFILE){
  const map=mapByPath(path);
  return map&&profile.maps.find(row=>row.id===map.id);
}
// A display label alone cannot enable conversion.
export function unsupportedMapName(path){return mapByPath(path)?.name;}
