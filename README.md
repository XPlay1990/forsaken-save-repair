# Warcraft III · Forsaken Save Repair

**Public beta · v0.1.0-beta.4.** A static recovery tool for pre-3.0.1 Forsaken
Kingdom saves, targeting Warcraft III 3.0.1.24342. Select the campaign folder,
choose one checkpoint, and download its repaired ZIP. Processing stays in a
browser worker; there are no save uploads, accounts, telemetry or remote APIs.

## Recovery and companions

All 20 installed campaign/prologue maps have authenticated, archive-derived
checksum targets. Identity repair updates both map-checksum fields and the
container CRCs while preserving the save build. Unknown maps are copied
unchanged; an unknown main map or invalid container cannot be exported as a
repaired checkpoint. The serialization build does not identify the source patch.
Later patches are unsupported.

Build-7000 saves on any recognized campaign/prologue map also receive the
Deathseeker projectile migration when the exact old `MUdb` layout is present.
This includes companion snapshots and earlier checksum-only repairs; a
previously observed source checksum is not required. The source patch still
cannot be inferred from the checksum or serialization build alone.
The `MUdb` allocation and instance records are validated before inserting the
observed extra field and restoring the buff identifier. Enclosing lengths and
container checksums are updated; object identifiers, saved Lua, quests and
inventory records remain unchanged. Unrecognized projectile layouts block
conversion. Current layouts are left intact, making repeated repair idempotent.
Other projectile types, unknown maps and newer serialization builds do not
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
fallback, including older `_repaired` filenames. Input filenames, companion
folders and serialized paths are preserved. Close the game, back up the campaign
folder, and copy the ZIP contents into it. The download itself leaves originals
unchanged. Test loading and travel, then save again under a new name.

Reports contain relative paths, identity/format metadata, projectile repair
counts and missing companions. They include no expanded gameplay data. A report
cannot recreate missing saved progression. Reports can also be downloaded when
conversion is blocked.

## Verification and limits

Player tests confirmed loading, travel and saving in Undercity / Trade Quarter,
Tirisfal Glades and Capital City Ruins. Scarlet checkpoints (1) and (6) loaded
with checksum repair. Targeted projectile repair made Neo's (4) load, followed
by native resaving and successful reload. Reversing those projectile fields in a
working current-engine save caused a loading crash. These observations do not
certify every quest, later transition or checkpoint.

The browser repair matches independently generated private Python outputs for
Scarlet (2)–(5), including an earlier checksum-only export, byte for byte.
The player also confirmed that targeted (2), (3) and (5) copies load. Subsequent
combat, quest progression and travel remain unverified. Scripts, quests,
inventory and unrelated native states are not migrated. Cross-map synthetic
tests cover all 20 recognized targets, old/current layouts, block boundaries,
misleading marker strings and companion exports. The projectile migration has
player validation in Scarlet Monastery; its use on other maps remains untested
in game.

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
Target metadata is in `src/map-checksums.mjs`; no game archives, scripts, saves
or account license material are distributed.

Support: Discord **_xplay** or [the community server](https://discord.gg/MZ63U7E4z).
