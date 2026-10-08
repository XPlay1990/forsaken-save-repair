# Save repair to-do

Internal development checklist; excluded from the published website.

- [ ] **Before release**: load the checksum-only `beforebaron_repaired_2` export, travel to both repaired companion maps, return to Undercity, and save again. This control matches the earlier identity-only repair byte for byte; the player has not tested it since folder migration was disabled.

- [ ] **Matching repaired-folder names — disabled after a loading crash**: the player reported `beforebaron_repaired` crashing during loading on 3.0.1. Independent native-zlib comparison verified exactly eight intended path edits across the main and three companions, but this did not establish engine-compatible serialization. The converter now preserves all folder paths and changes only map identity. Compare an original-path checksum-only `beforebaron` bundle in game before attributing the crash to a specific serialization field. Re-enable folder migration only after explaining the engine constraints and confirming loading, travel and resaving.

- [ ] **Act One — Arcane Sanctuary (`undeadre01_05`)**: find a pre-patch save and extract its old map checksum. The captured 3.0.1 checksum is `e3d412fe` (serialization build 7003). The old checksum is unknown. Verify the pair against an independent repair, then test loading, travel and saving in Warcraft III before enabling conversion.
- [ ] **Remaining Act One areas**: identify destinations, collect old/current save pairs for each map, and verify each companion bundle in the game.
- [ ] **Act Two**: collect old/current checksum pairs for every visited map, verify save formats and repaired companion bundles, then test loading, travel and saving.
- [ ] **Act Three**: collect old/current checksum pairs for every visited map, verify save formats and repaired companion bundles, then test loading, travel and saving.

Only verified pairs belong in `src/profiles.mjs`. A current-patch reference or a map name alone must never enable repair. Keep donor saves private.

Completed: Undercity (including Tradequarter), Capital City Ruins and Tirisfal Glades. Main-save loading, travel between these maps and saving again were confirmed in one recovered Act One playthrough.
