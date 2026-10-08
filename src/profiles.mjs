import {knownMap} from './map-catalog.mjs';
import {MAP_CHECKSUMS} from './map-checksums.mjs';

// Target validated pre-update saves at the installed 3.0.1 campaign maps.
// Old observations document provenance, rather than an exhaustive allowlist.
// A checksum repair does not port saved scripts.
const initial=['undeadre01','undeadre01_02','undeadre01_03'];
const targets=[...initial.map(id=>MAP_CHECKSUMS.find(map=>map.id===id)),
  ...MAP_CHECKSUMS.filter(map=>!initial.includes(map.id))];
export const PROFILE = Object.freeze({
  id:'forsaken-all-maps-to-301',name:'Forsaken Kingdom · All maps',
  from:'pre-3.0.1',to:'3.0.1',build:'24342',
  sourcePolicy:'Validated campaign save format; every non-target checksum is replaced with the archive-derived 3.0.1 target. Source patch cannot be inferred from the serialization build.',
  serializationBuilds: [7000, 7003],
  gameIdentifier: 0x57335850, gameVersion: 10200,
  verification:'All 20 targets derived from authenticated 3.0.1 archives; seven matched current-save donors. Player tested loading/travel in Undercity including Trade Quarter, Capital City Ruins and Tirisfal Glades, resaving and the checksum-only beforebaron export. Scarlet Monastery checkpoints (1)-(6) loaded; targeted Deathseeker projectile migration on (2)-(5), plus (4) native resave/reload. The player also reports every available Neo save works with the current converter; additional map coverage was not specified. The same exact projectile layouts are migrated on all recognized maps, including companions; cross-map synthetic checks passed, but projectile migration outside Scarlet remains untested in game.',
  maps:Object.freeze(targets.map(target=>Object.freeze({...target,
    name:target.id==='undeadre01'?'Undercity / Trade Quarter':knownMap(target.mapPath).name,
    old:target.oldObserved})))
});
export function mapProfile(path) {
  const normalized = path.toLowerCase().replaceAll('\\', '/');
  return PROFILE.maps.find(map => map.mapPath === normalized);
}
// A display label alone cannot enable conversion.
export function unsupportedMapName(path){
  return knownMap(path)?.name;
}
