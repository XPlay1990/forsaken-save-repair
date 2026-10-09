import {MAPS,mapByPath,patch} from './map-versions.mjs';

// A conversion profile retargets saves from one patch's map checksums to another's.
// Both directions are derived from the per-patch table in map-versions.mjs.
function targets(from,to,tested,order=[]){
  const sorted=[...order.map(id=>MAPS.find(map=>map.id===id)),...MAPS.filter(map=>!order.includes(map.id))];
  return Object.freeze(sorted.map(map=>Object.freeze({id:map.id,mapPath:map.mapPath,
    name:map.id==='undeadre01'?'Undercity / Trade Quarter':map.name,
    old:map.checksums[from],current:map.checksums[to],checksums:map.checksums,
    donorMatched:to==='3.0.0'?map.evidence['3.0.0'].originalSaveMatched:map.evidence['3.0.1'].donorSaveMatched,
    gameTested:map.gameTested[tested]})));
}
const common={gameIdentifier:0x57335850,gameVersion:10200};

// Upgrade: pre-3.0.1 saves to the 3.0.1 maps. Disabled while Blizzard ships 3.0.0; enable
// again (and refresh 3.0.1 checksums in map-versions.mjs) if the 3.0.1 maps return.
// Any non-target checksum is replaced: the serialization build does not identify the source patch.
export const PROFILE = Object.freeze({
  ...common,id:'forsaken-all-maps-to-301',name:'Forsaken Kingdom · Upgrade',
  from:'pre-3.0.1',to:'3.0.1',build:patch('3.0.1').executable.split('.').at(-1),
  direction:'upgrade',enabled:false,experimental:true,strictSource:false,serializationBuilds:[7000,7003],
  sourcePolicy:'Validated campaign save format; every non-target checksum is replaced with the archive-derived 3.0.1 target. Source patch cannot be inferred from the serialization build.',
  verification:'All 20 targets derived from authenticated 3.0.1 archives; seven matched current-save donors. Player-tested Act One locations: Undercity / Trade Quarter, Capital City Ruins and Tirisfal Glades, including travel and saving. Player-tested Act Two locations: Undercity starting map from their own save, Scarlet Monastery and Dawn\'s Watch from Neo saves. Scarlet checkpoints (1)-(6) loaded, including targeted Deathseeker migration on (2)-(5); (4) also saved and reloaded. All available Neo saves reported working. Other maps and full campaign progression remain unconfirmed. The exact projectile layouts are migrated across recognized maps, including companions; paired forward/reverse engine validation is specific to Scarlet.',
  maps:targets('3.0.0','3.0.1','upgrade',['undeadre01','undeadre01_02','undeadre01_03'])
});
// Downgrade: 3.0.1 saves, including ones written by the 3.0.1 game (build 7003), to restored 3.0.0.
export const DOWNGRADE_PROFILE = Object.freeze({
  ...common,id:'forsaken-all-maps-to-300',name:'Forsaken Kingdom · Downgrade',
  from:'3.0.1',to:'3.0.0',build:patch('3.0.0').executable.split('.').at(-1),
  direction:'downgrade',enabled:true,experimental:true,strictSource:true,serializationBuilds:[7000],nativeBuilds:[7003],
  sourcePolicy:'Only the verified 3.0.1 or restored 3.0.0 map checksum is accepted. Website repairs (build 7000) keep their build and saved scripts; only the exact Deathseeker native layout is reversed. Saves written by 3.0.1 (build 7003) additionally convert the 3.0.1 unit and camera fields, map 18 renamed natives back to their 3.0.0 names and remove nine unused 3.0.1-only native bindings. Saves whose scripts use 3.0.1-only natives are blocked.',
  verification:'All 20 downgrade targets extracted from authenticated installed rollback archives (content manifest 3.0.0.24248; running executable 3.0.0.24268); nine match original save controls. Reversing a repaired Scarlet Monastery (4) produced a byte-identical original that loaded in the restored game. Six Scarlet Monastery checkpoints saved by 3.0.1, from the start through the later boss state, were converted, loaded, re-saved and reloaded in 3.0.0. A renamed Cathedral bundle with its Act One zone snapshots (including travel) and an Act One progress save also worked. Experimental: other maps remain unconfirmed, and a Cathedral save made just before the boss transition loads with missing models.',
  maps:targets('3.0.1','3.0.0','downgrade')
});
export const PROFILES=Object.freeze([DOWNGRADE_PROFILE,PROFILE]);
export function conversionProfile(id){return PROFILES.find(profile=>profile.id===id);}
export function mapProfile(path,profile=PROFILE){
  const map=mapByPath(path);
  return map&&profile.maps.find(row=>row.id===map.id);
}
// A display label alone cannot enable conversion.
export function unsupportedMapName(path){return mapByPath(path)?.name;}
