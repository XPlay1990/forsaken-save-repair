# Save repair to-do

Internal development checklist; excluded from the published website.

- [ ] **Matching repaired-folder names**: player-test the new path migration with `after_baron`: load the repaired main save, travel to Capital City Ruins and Tirisfal Glades, return to Undercity, and save again. String lengths, container integrity and exact logical-payload preservation have passed native-zlib checks; engine behavior is pending.

- [ ] **Act One — Arcane Sanctuary (`undeadre01_05`)**: find a pre-patch save and extract its old map checksum. The captured 3.0.1 checksum is `e3d412fe` (serialization build 7003). The old checksum is unknown. Verify the pair against an independent repair, then test loading, travel and saving in Warcraft III before enabling conversion.
- [ ] **Remaining Act One areas**: identify destinations, collect old/current save pairs for each map, and verify each companion bundle in the game.
- [ ] **Act Two**: collect old/current checksum pairs for every visited map, verify save formats and repaired companion bundles, then test loading, travel and saving.
- [ ] **Act Three**: collect old/current checksum pairs for every visited map, verify save formats and repaired companion bundles, then test loading, travel and saving.

Only verified pairs belong in `src/profiles.mjs`. A current-patch reference or a map name alone must never enable repair. Keep donor saves private.

Completed: Undercity (including Tradequarter), Capital City Ruins and Tirisfal Glades. Main-save loading, travel between these maps and saving again were confirmed in one recovered Act One playthrough.
