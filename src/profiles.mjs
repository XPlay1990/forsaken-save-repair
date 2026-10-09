import {knownMap} from './map-catalog.mjs';
import {MAP_CHECKSUMS} from './map-checksums.mjs';
import {ROLLBACK_MAP_CHECKSUMS} from './rollback-map-checksums.mjs';

// Target validated pre-update saves at the installed 3.0.1 campaign maps.
// Old observations document provenance, rather than an exhaustive allowlist.
// A checksum repair does not port saved scripts.
const initial=['undeadre01','undeadre01_02','undeadre01_03'];
const targets=[...initial.map(id=>MAP_CHECKSUMS.find(map=>map.id===id)),
  ...MAP_CHECKSUMS.filter(map=>!initial.includes(map.id))];
export const PROFILE = Object.freeze({
  id:'forsaken-all-maps-to-301',name:'Forsaken Kingdom · All maps',
  from:'pre-3.0.1',to:'3.0.1',build:'24342',
  direction:'upgrade',strictSource:false,
  sourcePolicy:'Validated campaign save format; every non-target checksum is replaced with the archive-derived 3.0.1 target. Source patch cannot be inferred from the serialization build.',
  serializationBuilds: [7000, 7003],
  gameIdentifier: 0x57335850, gameVersion: 10200,
  verification:'All 20 targets derived from authenticated 3.0.1 archives; seven matched current-save donors. Player-tested Act One locations: Undercity / Trade Quarter, Capital City Ruins and Tirisfal Glades, including travel and saving. Player-tested Act Two locations: Undercity starting map from their own save, Scarlet Monastery and Dawn\'s Watch from Neo saves. Scarlet checkpoints (1)-(6) loaded, including targeted Deathseeker migration on (2)-(5); (4) also saved and reloaded. All available Neo saves reported working. Other maps and full campaign progression remain unconfirmed. The exact projectile layouts are migrated across recognized maps, including companions; paired forward/reverse engine validation is specific to Scarlet.',
  maps:Object.freeze(targets.map(target=>Object.freeze({...target,
    name:target.id==='undeadre01'?'Undercity / Trade Quarter':knownMap(target.mapPath).name,
    old:target.oldObserved})))
});
export const DOWNGRADE_PROFILE = Object.freeze({
  ...PROFILE,id:'forsaken-all-maps-to-300',name:'Forsaken Kingdom · Downgrade',
  from:'3.0.1',to:'3.0.0',build:'24268',direction:'downgrade',strictSource:true,serializationBuilds:[7000],
  sourcePolicy:'Only the verified 3.0.1 or restored 3.0.0 map checksum is accepted. Preserve the serialization build and saved scripts; reverse only the exact known Deathseeker native layout.',
  verification:'All 20 downgrade targets extracted from authenticated installed rollback archives (content manifest 3.0.0.24248; running executable 3.0.0.24268); nine match original save controls. Reversing a repaired Scarlet Monastery (4) produced a byte-identical original that loaded in the restored game. Native build-7003 resaves crashed despite checksum, projectile and build-tag changes, so they are blocked. Other downgrade maps and travel remain unconfirmed.',
  maps:Object.freeze(PROFILE.maps.map(map=>{
    const target=ROLLBACK_MAP_CHECKSUMS.find(row=>row.id===map.id);
    return Object.freeze({...map,old:map.current,current:target.checksum,donorMatched:target.observedOriginalMatched,gameTested:map.id==='undeadre02_06'});
  }))
});
export const PROFILES=Object.freeze([DOWNGRADE_PROFILE,PROFILE]);
export function conversionProfile(id){return PROFILES.find(profile=>profile.id===id);}
export function mapProfile(path,profile=PROFILE) {
  const normalized = path.toLowerCase().replaceAll('\\', '/');
  return profile.maps.find(map => map.mapPath === normalized);
}
// A display label alone cannot enable conversion.
export function unsupportedMapName(path){
  return knownMap(path)?.name;
}
