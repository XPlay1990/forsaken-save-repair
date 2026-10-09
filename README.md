# Warcraft III · Forsaken Save Repair

**Public beta · v0.1.0-beta.4.** A static recovery tool for Forsaken
Kingdom saves. Select the installed game version and campaign folder,
choose one checkpoint, and download its repaired ZIP. Processing stays in a
browser worker; there are no save uploads, accounts, telemetry or remote APIs.

## Local rollback preview — not yet published

The 3.0.0 target reverses a website repair for saves that were **not re-saved
by the 3.0.1 game**. It restores the authenticated rollback map checksums and
reverses the exact known Deathseeker layout, including companion snapshots.
Names and stored companion paths remain unchanged. Both the 3.0.1 and restored
3.0.0 checksums are accepted; other source revisions block downgrade exports.

Saves written by the 3.0.1 game itself (serialization build 7003) are converted
as well (`src/native-downgrade.mjs`):

- map 18 natives renamed in 3.0.1 back to their 3.0.0 names, and remove nine
  3.0.1-only native bindings only when nothing besides their `_G` entry uses
  them; saved Lua references are renumbered and the graph is re-read to verify;
- remove the 3.0.1 unit fields (a zero dword 665 bytes before the end and a
  16-byte suffix), reverse the Deathseeker projectile layout and remove the
  four-byte camera field at state offset 304;
- rewrite the lengths of the record around the saved Lua, whose header lists
  pending trigger waits, then restore the 3.0.0 checksum and build 7000.

Saves whose scripts come from the 3.0.1 version of a map (for example Act Two
started after the patch) call some 3.0.1-only natives inside 3.0.1 `blizzard.j`
helpers. Those globals are rebound to the closest 3.0.0 behaviour and reported:
`BlzRemoveEffect` → `DestroyEffect`, `ChooseRandomItemExWithFilterAndIncludes` →
`ChooseRandomItemExWithFilter`, `BlzSetThematicMusicAbsoluteVolume` →
`SetThematicMusicVolume`, and `BlzSetCameraAllowsHotkeyTargetLock` / `BlzUnitHeal`
→ the map's `DoNothing`. This path is not yet tested in game.

Saved Lua is parsed as data and never executed. Saves calling a 3.0.1-only native
without a fallback, and unrecognized layouts, are blocked; a blocked companion blocks the whole bundle. Six Scarlet
Monastery checkpoints saved in 3.0.1, from the start to the later boss state,
loaded in restored 3.0.0 and could be saved and reloaded. The browser output is
byte-identical to those tested files (`scripts/check-private-native.mjs`).

Reversing Neo's repaired Scarlet Monastery `(4)` produced the byte-identical
original, which the player loaded successfully in the restored game. The player
also re-saved and reloaded fresh 3.0.0 references from `(1)` and `(4)`. Other
downgrade maps, travel and continued campaign progression remain unconfirmed.
Installed content metadata lists 3.0.0.24248, while the running executable and
its crash reports identify 3.0.0.24268; the targets were extracted from that same
local rollback installation. No game content is shipped.

## Recovery and companions

The following upgrade behavior targets Warcraft III 3.0.1.24342.

All 20 installed campaign/prologue maps have authenticated, archive-derived
checksum targets. Identity repair updates both map-checksum fields and the
container CRCs while preserving the save build. Unknown maps are copied
unchanged; an unknown main map or invalid container cannot be exported as a
repaired checkpoint. The serialization build does not identify the source patch.
Later patches are unsupported.

Saves in the accepted format on any recognized campaign/prologue map receive the
Deathseeker projectile migration when the exact old `MUdb` layout is present.
This includes companion snapshots and earlier checksum-only repairs; a
previously observed source checksum is not required. The source patch still
cannot be inferred from the checksum or serialization build alone.
The `MUdb` allocation and instance records are validated before inserting the
observed extra field and restoring the buff identifier. Enclosing lengths and
container checksums are updated; object identifiers, saved Lua, quests and
inventory records remain unchanged. Unrecognized projectile layouts block
conversion. Current layouts are left intact, making repeated repair idempotent.
Other projectile types, unknown maps and unrecognized serialization builds do not
receive this native-state migration. Detection validates native tables instead
of taking the first occurrence of a marker, which may also occur in saved text.

The selected main save's stored companion path takes precedence over a
filename match. This supports `Blizzard`, `FKManualSaves`, `CustomSaves` and other
safe relative roots named by stored save-file paths, including numbered or
renamed checkpoints. A typed manual-directory string can discover its existing
snapshots, but does not invent missing files when the directory is empty or
absent. Explicit missing file references are reported. Multiple conflicting
directories stop selection. Companion contents cannot expand the selection into
other checkpoints; working `Zones` folders are excluded.

Without a stored path, the tool retains the legacy same-name Blizzard-folder
fallback, including older `_repaired` filenames.

Outputs are named `<name>_downgraded_3.0.0` or `<name>_upgraded_3.0.1`, and the
companion folder (`Blizzard<name>` or `FKManualSaves<name>`) is renamed to match,
so copying the ZIP into the campaign folder never replaces the original checkpoint.
The campaign script stores that folder as Lua strings in the main save; those strings
are rewritten (`src/save-rename.mjs`) and the saved Lua is re-read with all three Lua
lengths updated. An earlier rename attempt changed the strings without the Lua
lengths, which is why it crashed. Test loading and travel, then save again.

Reports contain relative paths, identity/format metadata, projectile repair
counts and missing companions. They include no expanded gameplay data. A report
cannot recreate missing saved progression. Reports can also be downloaded when
conversion is blocked.

## Verification and limits

Player-tested locations are Act One's Undercity / Trade Quarter, Tirisfal Glades
and Capital City Ruins, and Act Two's Undercity starting map, Scarlet Monastery
and Dawn's Watch. Act One tests included travel and saving. Scarlet checkpoints (1) and (6) loaded
with checksum repair. Targeted projectile repair made Neo's (4) load, followed
by native resaving and successful reload. Reversing those projectile fields in a
working current-engine save caused a loading crash. These observations do not
certify every quest, later transition or checkpoint.

The browser repair matches independently generated private Python outputs for
Scarlet (2)–(5), including an earlier checksum-only export, byte for byte.
The player also confirmed that targeted (2), (3) and (5) copies load.
On 2026-10-08, the player reported testing every Neo save available to them with
the current converter and said they all work, subsequently identifying Scarlet
Monastery and Dawn's Watch as tested Neo locations and the Act Two starting map
as tested with their own save. Other maps remain unconfirmed; these tests do not
establish a complete campaign playthrough.
Subsequent combat, quest progression and travel remain unverified. Scripts, quests,
inventory and unrelated native states are not migrated. Cross-map synthetic
tests cover all 20 recognized targets, old/current layouts, block boundaries,
misleading marker strings and companion exports. The projectile migration has
direct paired forward/reverse validation in Scarlet Monastery. The additional
successful map tests do not identify which saves needed projectile migration.

Folder listing reads metadata only, so a collection larger than 1 GB is allowed.
The selected checkpoint and companions are limited to 1 GB and 5,000 files.
Files are processed sequentially. A streaming type scan keeps saves without
Deathseeker projectiles on the block-by-block path; candidate saves are expanded
one at a time for native layout analysis. ZIP entries
are stored because the game saves are already compressed.

## Development

Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm test
npm start
```

Open http://127.0.0.1:4173/. `dist/` contains the static site; internal `todo.md`
and private game files are excluded. Synthetic tests run in GitHub Actions.
Local private comparisons are optional:

```sh
node scripts/check-private-scarlet.mjs /path/to/private/scarlet-diagnosis
node scripts/browser-check.mjs
```

Push `main` to deploy with the included GitHub Pages workflow. The repository
must enable Pages with GitHub Actions as its source. Dependencies are bundled
locally with their licenses; see [THIRD_PARTY.md](THIRD_PARTY.md).
Map names and per-patch checksums are in `src/map-versions.mjs` (one row per map, one checksum column per patch; conversion profiles in `src/profiles.mjs` derive from it); no game archives, scripts, saves
or account license material are distributed.

Support: Discord **_xplay** or [the community server](https://discord.gg/MZ63U7E4z).
