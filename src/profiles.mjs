/** Registry is deliberately limited to exact map/revision pairs verified locally. */
export const PROFILE = Object.freeze({
  id: 'forsaken-act1-300-to-301',
  name: 'Forsaken Kingdom · Act One',
  from: '3.0.0', to: '3.0.1', build: '24342',
  serializationBuilds: [7000, 7003],
  gameIdentifier: 0x57335850, gameVersion: 10200,
  verification: 'Player confirmed loading and travel between the supported areas, saving again in Undercity, and a successful checksum-only beforebaron playtest.',
  maps: [
    {id: 'undeadre01', name: 'Undercity / Trade Quarter', old: 'd14c260a', current: '3c2f7a2e'},
    {id: 'undeadre01_02', name: 'Capital City Ruins', old: '5035caa4', current: '9ef8ba27'},
    {id: 'undeadre01_03', name: 'Tirisfal Glades', old: 'aa301d70', current: '990b99db'}
  ]
});
export function mapProfile(path) {
  const normalized = path.toLowerCase().replaceAll('\\', '/');
  return PROFILE.maps.find(map => normalized === `campaign/forsakenkingdom/${map.id}.w3xd`);
}
// A display label supplies no checksum pair and cannot enable conversion.
export function unsupportedMapName(path){
  return path.toLowerCase().replaceAll('\\','/')==='campaign/forsakenkingdom/undeadre01_05.w3xd'?'Arcane Sanctuary':undefined;
}
