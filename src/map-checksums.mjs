/** Target checksums derived from authenticated installed 3.0.1.24342 archives.
 * Engine XOR/rotate routine matched seven current-save donors. profiles.mjs governs
 * the accepted save formats; gameTested records actual player validation.
 * Raw checksums are four little-endian bytes rendered as hex, not numeric hex.
 */
export const TARGET_BUILD = '3.0.1.24342';
export const MAP_CHECKSUMS = Object.freeze([
  {
    "id": "humanre01",
    "mapPath": "campaign/forsakenkingdom/humanre01.w3xd",
    "current": "ca9a5714",
    "oldObserved": "b25f80d8",
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "humanre02",
    "mapPath": "campaign/forsakenkingdom/humanre02.w3xd",
    "current": "b4eccbd3",
    "oldObserved": "cf967337",
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "humanre02interlude",
    "mapPath": "campaign/forsakenkingdom/humanre02interlude.w3xd",
    "current": "91350542",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "humanre03",
    "mapPath": "campaign/forsakenkingdom/humanre03.w3xd",
    "current": "d7b54f10",
    "oldObserved": "4ced8316",
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "humanre04",
    "mapPath": "campaign/forsakenkingdom/humanre04.w3xd",
    "current": "0c7bceae",
    "oldObserved": "6b5baefc",
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre01",
    "mapPath": "campaign/forsakenkingdom/undeadre01.w3xd",
    "current": "3c2f7a2e",
    "oldObserved": "d14c260a",
    "donorMatched": true,
    "gameTested": true
  },
  {
    "id": "undeadre01_02",
    "mapPath": "campaign/forsakenkingdom/undeadre01_02.w3xd",
    "current": "9ef8ba27",
    "oldObserved": "5035caa4",
    "donorMatched": true,
    "gameTested": true
  },
  {
    "id": "undeadre01_03",
    "mapPath": "campaign/forsakenkingdom/undeadre01_03.w3xd",
    "current": "990b99db",
    "oldObserved": "aa301d70",
    "donorMatched": true,
    "gameTested": true
  },
  {
    "id": "undeadre01_04",
    "mapPath": "campaign/forsakenkingdom/undeadre01_04.w3xd",
    "current": "29dee716",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre01_05",
    "mapPath": "campaign/forsakenkingdom/undeadre01_05.w3xd",
    "current": "e3d412fe",
    "oldObserved": null,
    "donorMatched": true,
    "gameTested": false
  },
  {
    "id": "undeadre01_06",
    "mapPath": "campaign/forsakenkingdom/undeadre01_06.w3xd",
    "current": "eb044a18",
    "oldObserved": null,
    "donorMatched": true,
    "gameTested": false
  },
  {
    "id": "undeadre02",
    "mapPath": "campaign/forsakenkingdom/undeadre02.w3xd",
    "current": "e18988c1",
    "oldObserved": "35f0eca7",
    "donorMatched": true,
    "gameTested": false
  },
  {
    "id": "undeadre02_01",
    "mapPath": "campaign/forsakenkingdom/undeadre02_01.w3xd",
    "current": "c8cc7766",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre02_02",
    "mapPath": "campaign/forsakenkingdom/undeadre02_02.w3xd",
    "current": "82f43adf",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre02_03",
    "mapPath": "campaign/forsakenkingdom/undeadre02_03.w3xd",
    "current": "19136c27",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre02_04",
    "mapPath": "campaign/forsakenkingdom/undeadre02_04.w3xd",
    "current": "d156fd27",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre02_06",
    "mapPath": "campaign/forsakenkingdom/undeadre02_06.w3xd",
    "current": "3cb04734",
    "oldObserved": "b0669dc1",
    "donorMatched": true,
    "gameTested": true
  },
  {
    "id": "undeadre03a",
    "mapPath": "campaign/forsakenkingdom/undeadre03a.w3xd",
    "current": "66ed1037",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre03b",
    "mapPath": "campaign/forsakenkingdom/undeadre03b.w3xd",
    "current": "c6d586ec",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  },
  {
    "id": "undeadre03interlude",
    "mapPath": "campaign/forsakenkingdom/undeadre03interlude.w3xd",
    "current": "9bd1600b",
    "oldObserved": null,
    "donorMatched": false,
    "gameTested": false
  }
].map(Object.freeze));
export function targetMapChecksum(path){
  const normalized = path.toLowerCase().replaceAll('\\','/');
  return MAP_CHECKSUMS.find(map => map.mapPath === normalized);
}
