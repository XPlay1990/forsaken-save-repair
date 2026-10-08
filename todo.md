# Save repair to-do

Internal development checklist; excluded from the published website.

- [x] **Checksum-only export playtest**: on 2026-10-08, the player reported that the `beforebaron` playtest works after folder migration was disabled.

- [ ] **Matching repaired-folder names — disabled after a loading crash**: the player reported `beforebaron_repaired` crashing during loading on 3.0.1. Independent native-zlib comparison verified exactly eight intended path edits across the main and three companions, but this did not establish engine-compatible serialization. The checksum-only `beforebaron` control subsequently passed the player's playtest with original folder paths. The exact engine constraint remains unresolved. Re-enable folder migration only after explaining it and confirming loading, travel and resaving.

- [ ] **Act One — Arcane Sanctuary (`undeadre01_05`)**: find a pre-patch save and extract its old map checksum. The captured 3.0.1 checksum is `e3d412fe` (serialization build 7003). The old checksum is unknown. Verify the pair against an independent repair, then test loading, travel and saving in Warcraft III before enabling conversion.
- [ ] **Act One — Cathedral (`undeadre01_06`)**: `before_Act_2_2.w3z` supplies current checksum `eb044a18` (build 7003). `before_Act_2.w3z` also has this current checksum; an old checksum is still needed. No `_06` companion snapshot was found in the campaign or recovery backups inspected on 2026-10-08.
- [ ] **Act One — Silverpine Sprint (`undeadre01_04`)**: collect old/current same-map donors and verify loading, travel and saving. The loading-screen filename supplies the location label; no checksum pair is available yet.
- [ ] **Act Two start — Undercity (`undeadre02`)**: donor-verified pair `35f0eca7` → `e18988c1`, from `actwo start.w3z` (build 7000) and `act_two_after_patch.w3z` (build 7003). All container checks passed. A private checksum-only test copy was generated and independently matched the browser repair in a temporary verification process; the public profile remains unchanged pending a game test. The old checkpoint has no same-name companion directory, so this is a main-save load test only.
- [ ] **Remaining Act Two maps**: Forgotten Hollow (`undeadre02_01`), Tirisfal Glades Villages (`undeadre02_02`), Blackrock Encampment (`undeadre02_03`), Dawn's Watch (`undeadre02_04`), and Scarlet Monastery (`undeadre02_06`). Collect old/current pairs and verify each bundle in game. These location labels come from loading-screen filenames.
- [ ] **Act Three**: Capital City Ruins (`undeadre03a`), Naxxramas (`undeadre03b`), and the interlude A Looming Shadow (`undeadre03interlude`). Collect same-map old/current pairs and verify each bundle in game.
- [ ] **Separate prologue — The Last Days of Lordaeron**: Homecoming (`humanre01`), Treachery (`humanre02`), Lightbringer (`humanre02interlude`), Siege (`humanre03`), and Vengeance (`humanre04`). These share the archive folder but are a separate campaign, as shown by campaign UI metadata.

Only verified pairs belong in `src/profiles.mjs`. A current-patch reference or a map name alone must never enable repair. Keep donor saves private.

Completed: Trade Quarter, Undercity, Capital City Ruins and Tirisfal Glades. Trade Quarter shares Undercity's `undeadre01` map identity, confirmed again from the two new Trade Quarter and Lower Undercity saves on 2026-10-08: both `undeadre01`, checksum `3c2f7a2e`, build 7003. Main-save loading, travel between these locations and saving again were confirmed in a recovered Act One playthrough.
