/** Known destinations are tracked separately from verified repair pairs. */
export const ROADMAP = Object.freeze([
  {id:'act1-core',act:'ACT I',name:'Undercity, Capital City Ruins & Tirisfal Glades',status:'complete',badge:'Verified',detail:'Checksum pairs verified. Loading, map travel, and saving again were tested in a recovered playthrough.'},
  {id:'arcane-sanctuary',act:'ACT I',name:'Arcane Sanctuary',status:'pending',badge:'Old ID missing',mapId:'undeadre01_05',currentChecksum:'e3d412fe',detail:'Current-patch reference captured. Still needs a matching pre-patch save, then loading and travel tests.'},
  {id:'act1-remaining',act:'ACT I',name:'Remaining Act One areas',status:'pending',badge:'To discover',detail:'Identify the remaining destinations and collect old/current save pairs for each map.'},
  {id:'act2',act:'ACT II',name:'Act Two recovery',status:'planned',badge:'Planned',detail:'Collect old/current checksums for every visited map, repair companion bundles, and verify travel.'},
  {id:'act3',act:'ACT III',name:'Act Three recovery',status:'planned',badge:'Planned',detail:'Collect old/current checksums for every visited map, repair companion bundles, and verify travel.'}
]);
export function pendingMapProfile(path){const normalized=path.toLowerCase().replaceAll('\\','/');return ROADMAP.find(item=>item.mapId&&normalized===`campaign/forsakenkingdom/${item.mapId}.w3xd`);}
