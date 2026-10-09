# Release notes

## v0.1.0-beta.5 — experimental downgrade to restored 3.0.0

Blizzard reverted patch 3.0.1. This release adds an **experimental** downgrade to
the restored 3.0.0 game; the upgrade direction stays available in code but its tab
is disabled until the 3.0.1 maps return (`?preview=upgrade` locally).

- Downgrade/Upgrade tabs replace the version selector; Downgrade is the default.
  Both directions are marked Experimental; reports carry `experimental: true`.
- Downgrade saves written by Warcraft III 3.0.1 (build 7003): map renamed natives
  back to 3.0.0, remove unused 3.0.1-only native bindings, renumber saved Lua
  references, rewrite the Lua record header (which lists pending trigger waits),
  remove the 3.0.1 unit fields (zero dword 665 bytes before the end and a 16-byte
  suffix), the camera field and the projectile field of any missile model, and
  restore the 3.0.0 checksum and build 7000. Saved Lua is parsed, never executed.
- Saves whose scripts come from the 3.0.1 version of a map get 3.0.0 fallbacks for
  the 3.0.1-only functions they call (BlzRemoveEffect → DestroyEffect,
  ChooseRandomItemExWithFilterAndIncludes → ChooseRandomItemExWithFilter, camera
  target lock and BlzUnitHeal → DoNothing); each fallback is listed per save.
  Natives without a fallback and unknown layouts block the bundle with a report.
- Website repairs of original saves (build 7000) are reversed exactly, including
  the Deathseeker record migration.
- Outputs are named `<name>_downgraded_3.0.0` (or `<name>_upgraded_3.0.1`) and the
  companion folder is renamed to match; the folder paths stored in the saved Lua
  are rewritten with correct Lua lengths. Extracting the ZIP never replaces the
  original checkpoint.
- One table (`src/map-versions.mjs`) holds every map's checksum per patch;
  both conversion directions derive from it.

Player validation in restored 3.0.0: six Scarlet Monastery checkpoints saved in
3.0.1 (start to the later boss state) loaded, saved and reloaded; the renamed
Cathedral `before_Act_2` bundle (with its four Act One zone snapshots) and
`act1_progress_after_patch` worked. A Cathedral save made just before the boss transition
(`before_Act_2_2`) loads with missing doodad and cliff models; this is under
investigation. Other maps remain unconfirmed.

## v0.1.0-beta.4

- Detect and migrate the verified old Deathseeker projectile layout on every
  recognized campaign/prologue map, including companion snapshots and earlier
  checksum-only outputs. Preserve current layouts and unrelated projectiles.
- Validate allocation tables beyond misleading marker strings and detect type
  identifiers across block boundaries. Reject ambiguous tables and unknown
  Deathseeker state layouts. Saves without this type retain streaming processing.
- Cross-map synthetic and companion-export tests passed. Real Scarlet outputs
  still match the player-tested repairs; projectile migration on other maps has
  not yet been tested in game.
- On 2026-10-08, the player reported that every available Neo save works with
  the current converter, identifying Scarlet Monastery and Dawn's Watch as
  tested Neo locations and Act Two's starting map as tested with their own save.
  Full campaign progression remains unverified.
- Simplify the website's limitations to tested Act One/Two locations, unconfirmed
  maps and the supported patch. Remove the map-coverage row.

## v0.1.0-beta.3

- Repair the known Deathseeker projectile-state incompatibility in old Scarlet
  Monastery saves, including earlier checksum-only outputs. Checkpoints (2)–(5)
  loaded; (4) also passed native resaving and reloading. Quests and inventory stay intact.
- Prefer the saved companion directory over filename matching. Support
  `FKManualSaves`, numbered checkpoint folders and safe stored file paths; keep
  unrelated checkpoints and working Zones excluded.
- Add Warcraft III branding and Discord contact `_xplay` / community server.
- Reports identify projectile repairs. Unknown native layouts stop conversion;
  repeated conversion leaves already repaired saves unchanged.

## v0.1.0-beta.2

- Fix a false missing-companion warning for standalone saves. A missing
  same-name folder alone no longer requires acknowledging a partial download.
  Missing folders and files referenced by the save are still reported.
- Preserve checkpoint scope and numbered filenames such as `(3)` and `(4)`.
  Unrelated Act One folders and working Zones are not selected as companions.
- Clarify testing limits: one Scarlet Monastery checkpoint passed load/save/reload
  without companions; later checkpoints still crash during loading. Checksum
  repair does not migrate saved gameplay or script state.

## v0.1.0-beta.1

First public beta for recovering pre-3.0.1 Forsaken Kingdom saves on
Warcraft III 3.0.1.24342.

- Covers the target checksums for all 15 Forsaken Kingdom maps and five maps
  from the separate prologue, The Last Days of Lordaeron.
- Select the campaign folder, choose one checkpoint, and download a ZIP
  containing that save, its associated companion files, and a repair report.
- Processing stays in your browser. Saves are never uploaded.
- Preserves original filenames, companion folders, saved paths, and gameplay
  data. Close the game and back up the campaign folder before restoring the ZIP.

Loading and travel have been confirmed in Undercity (including Trade Quarter),
Tirisfal Glades, and Capital City Ruins, with saving again in Undercity.
Other areas, Acts Two/Three, and the prologue still need gameplay testing.
Checksum repair does not port saved quest or item-drop scripts. Later patches
and unrecognized or damaged save formats are unsupported; missing companion
files cannot be reconstructed from a report.

Validation: 47 automated checks passed with private native-save controls;
browser checks covered folder selection, checkpoint isolation, downloads,
reports, offline processing, and mobile layout. No game saves are distributed.
