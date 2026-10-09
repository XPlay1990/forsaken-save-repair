# Warcraft III · Forsaken Save Repair

**Public beta · v0.1.0-beta.5.** A static recovery tool for Forsaken Kingdom
saves. Choose the campaign folder and one checkpoint, and download a ZIP with the
converted save and its companion snapshots. Processing stays in a browser worker;
there are no save uploads, accounts, telemetry or remote APIs.

The site has two tabs, both **experimental**:

- **Downgrade** (default): saves from patch 3.0.1 → the restored Warcraft III 3.0.0
  that Blizzard rolled back to.
- **Upgrade**: saves from before 3.0.1 → 3.0.1.24342. Disabled while Blizzard ships
  3.0.0; it is enabled again if the 3.0.1 maps return, and can be previewed locally
  with `?preview=upgrade`.

## Downgrade to restored 3.0.0

Two kinds of saves are converted:

- **Website repairs** of original saves (build 7000, never re-saved by the 3.0.1
  game) are reversed exactly: the 3.0.0 map checksums are restored and the
  Deathseeker projectile migration is undone, including companion snapshots.
- **Saves written by the 3.0.1 game** (serialization build 7003) are converted
  (`src/native-downgrade.mjs`):
  - 18 natives renamed in 3.0.1 are mapped back to their 3.0.0 names. Nine
    3.0.1-only native bindings are removed when nothing besides their `_G` entry
    uses them. Saved Lua references are renumbered and the graph is re-read to
    verify.
  - The 3.0.1 unit fields (a zero dword 665 bytes before the end and a 16-byte
    suffix), the projectile field of any missile model and the four-byte camera
    field at state offset 304 are removed.
  - The lengths around the saved Lua record, whose header lists pending trigger
    waits, are rewritten; then the 3.0.0 checksum and build 7000 are restored.

Saves whose scripts come from the 3.0.1 version of a map (for example Act Two
started after the patch) call some 3.0.1-only natives inside 3.0.1 `blizzard.j`
helpers. Those globals are rebound to the closest 3.0.0 behaviour, and each one is
listed in the report: `BlzRemoveEffect` → `DestroyEffect`,
`ChooseRandomItemExWithFilterAndIncludes` → `ChooseRandomItemExWithFilter`,
`BlzSetThematicMusicAbsoluteVolume` → `SetThematicMusicVolume`, and
`BlzSetCameraAllowsHotkeyTargetLock` / `BlzUnitHeal` → the map's `DoNothing`.

Saved Lua is parsed as data and never executed. Saves calling a 3.0.1-only native
without a fallback, unknown source checksums and unrecognized layouts are blocked;
a blocked companion blocks the whole bundle, and the report can still be downloaded.

### Missing models: the graphics flag

A u32 after the player name in a save's first block makes loading switch to the
Definitive Edition graphics mode. A fresh Forsaken Kingdom map start writes 4,
but 3.0.0 writes 0 into every save made after loading a save. Such saves load in
the player's own graphics mode: with **Classic** graphics, the Definitive Edition
models (Undercity and Cathedral doodads, Forsaken units) fail to load; with
Reforged graphics they load normally. Exports set the flag back to 4 on main saves
and companion snapshots, and 3.0.0 saves with flag 0 on any supported map can be
selected in the Downgrade tab to repair just that byte. Saving again in game after
a load writes 0 again.

### Downgrade testing

In restored 3.0.0 (executable 3.0.0.24268; installed content metadata lists
3.0.0.24248), these saves loaded, were saved again and reloaded:

- six Scarlet Monastery checkpoints saved in 3.0.1, from the start to the later
  boss state; the browser output is byte-identical to the tested files
  (`scripts/check-private-native.mjs`);
- Act Two's starting map, converted with the script fallbacks;
- the Cathedral (`before_Act_2`, including travel with its four Act One zone
  snapshots) and Arcane Sanctuary (`act1_progress_after_patch`).

Reversing Neo's repaired Scarlet Monastery `(4)` produced the byte-identical
original, which loaded. Other maps, later transitions and a complete campaign
playthrough remain unconfirmed.

## Upgrade to 3.0.1 (disabled)

This direction targets Warcraft III 3.0.1.24342. All 20 installed
campaign/prologue maps have authenticated, archive-derived checksum targets.
Identity repair updates both map-checksum fields and the container CRCs while
preserving the save build. Unknown maps are copied unchanged; an unknown main map
or invalid container cannot be exported as a repaired checkpoint. The
serialization build does not identify the source patch.

Saves in the accepted format on any recognized campaign/prologue map receive the
Deathseeker projectile migration when the exact old `MUdb` layout is present,
including companion snapshots and earlier checksum-only repairs. The `MUdb`
allocation and instance records are validated before inserting the observed extra
field and restoring the buff identifier. Enclosing lengths and container
checksums are updated; object identifiers, saved Lua, quests and inventory
records remain unchanged. Unrecognized projectile layouts block conversion.
Current layouts are left intact, so repeated repair is idempotent. Detection
validates native tables instead of taking the first occurrence of a marker, which
may also occur in saved text.

Player-tested locations are Act One's Undercity / Trade Quarter, Tirisfal Glades
and Capital City Ruins, and Act Two's Undercity starting map, Scarlet Monastery
and Dawn's Watch. Act One tests included travel and saving. Targeted projectile
repair made Neo's Scarlet `(4)` load, followed by native resaving and a successful
reload; the browser repair matches independently generated outputs for Scarlet
`(2)`–`(5)` byte for byte. Reversing those projectile fields in a working
current-engine save caused a loading crash.

## Companions and output names

The selected main save's stored companion path takes precedence over a filename
match. This supports `Blizzard`, `FKManualSaves`, `CustomSaves` and other safe
relative roots named by stored save-file paths, including numbered or renamed
checkpoints. A typed manual-directory string can discover its existing snapshots,
but does not invent missing files when the directory is empty or absent. Explicit
missing file references are reported. Multiple conflicting directories stop
selection. Companion contents cannot expand the selection into other checkpoints;
working `Zones` folders are excluded. Without a stored path, the tool falls back
to the same-name `Blizzard` folder, including older `_repaired` filenames.

Outputs are named `<name>_downgraded_3.0.0` or `<name>_upgraded_3.0.1`, and the
companion folder (`Blizzard\<name>` or `FKManualSaves\<name>`) is renamed to match,
so extracting the ZIP into the campaign folder never replaces the original
checkpoint. The campaign script stores that folder as Lua strings in the main
save; they are rewritten (`src/save-rename.mjs`) with all three Lua lengths
updated, and the saved Lua is re-read to verify.

Reports contain relative paths, identity/format metadata, conversion counts,
script fallbacks and missing companions. They include no expanded gameplay data
and cannot recreate missing saved progression.

## Limits

Scripts, quests, inventory and unrelated native states are not migrated. Synthetic
tests cover all 20 recognized maps, old/current layouts, block boundaries,
misleading marker strings, native 3.0.1 conversions, renamed companions and the
graphics flag. Later patches are unsupported.

Folder listing reads metadata only, so a collection larger than 1 GB is allowed.
The selected checkpoint and companions are limited to 1 GB and 5,000 files. Files
are processed sequentially; saves that need native conversion are expanded one at
a time. ZIP entries are stored because the game saves are already compressed.

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
Optional local checks against private saves (not in this repository):

```sh
node scripts/check-private-native.mjs /path/to/private/project
node scripts/check-private-scarlet.mjs /path/to/private/scarlet-diagnosis
node scripts/browser-check.mjs
```

Push `main` to deploy with the included GitHub Pages workflow. The repository
must enable Pages with GitHub Actions as its source. Dependencies are bundled
locally with their licenses; see [THIRD_PARTY.md](THIRD_PARTY.md). Map names and
per-patch checksums are in `src/map-versions.mjs` (one row per map, one checksum
column per patch); the conversion profiles in `src/profiles.mjs` derive from it.
No game archives, scripts, saves or account license material are distributed.

Support: Discord **_xplay** or [the community server](https://discord.gg/MZ63U7E4z).
