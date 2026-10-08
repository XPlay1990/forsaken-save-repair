# Forsaken Save Repair

A static, browser-only recovery tool for **Warcraft III: Forsaken Kingdom,
the three verified Act One maps, patch 3.0.0 → 3.0.1 (build 24342)**. Select the complete campaign
folder, pick one checkpoint, and download its repaired bundle. Folder selection
is the only input workflow; repaired bundles download as ZIP files.

All save processing runs in a Web Worker on the player's computer. No save
uploads, telemetry, account login, remote APIs, CDN assets, or persistent storage
are used. GitHub Pages only serves the application files. Save data stays out of
this repository and its Actions artifacts.

## Supported repair

The initial profile contains exact, verified old/current checksum pairs for
Undercity, Capital City Ruins, and Tirisfal Glades. It updates the encoded
settings identity and the plain map-checksum field, retains the original save
build and gameplay payload, recompresses only the first block for the identity
repair, and rebuilds the container integrity checksums.

The output now pairs `name_repaired.w3z` with `Blizzard/name_repaired/`.
Folder migration rewrites observed Lua string records (type 4 followed by an
eight-byte little-endian UTF-8 byte length) whose value is a checkpoint directory
or a checkpoint `.w3z` path. This applies to the main file and its selected
companion snapshots, whose recorded checkpoint names may differ. Working
`Blizzard/Zones` paths, map filenames, base directory constants, and other data
are retained. Longer or shorter strings require repacking from the first changed
block and updating payload size, block count, compression and integrity fields.
Compressed blocks before that point are preserved.

Every migrated output is checked by reversing the recorded string edits and
comparing the reconstructed logical payload exactly against the checksum-repaired
input. Tests use native Node zlib fixtures, including boundary crossings and
block-count changes. A separate Python/native-zlib checker also verified the
real `after_baron` main save and its companions. **Folder migration awaits player
loading, travel and resave tests.** The earlier confirmed playthrough covered
checksum repair with original companion paths.

Main-save loading, travel between all three maps, and saving again in Undercity
were confirmed by a player. This is one recovered playthrough, not proof that
every campaign script is compatible. Other Act One areas also need separately
verified donors before they can be added. The tool does **not** port saved quest or
item-drop scripts. Unknown checksums for a supported map block export rather
than guessing. Unsupported companion map checksums remain unchanged and are
identified in the report; their folder paths can still be migrated when their
container and serialization build match the checked format. Unsupported main
saves remain ineligible for conversion.

Select the `ForsakenKingdom` folder. The worker lists main save filenames using
metadata only; the collection's total size is not subject to the processing cap.
Pick a checkpoint to read just its main save and associated `Blizzard` folder.
The matching `Blizzard/<save-name>/` folder is selected, with an original-name
fallback for `_repaired` filenames. If neither folder exists, the selected main
save's stored paths can identify one original companion folder. Ambiguous
fallbacks stop conversion rather than including multiple checkpoints.
Companion snapshots may contain older folder names in their saved state;
those strings do not expand the selection into other checkpoint folders.
Missing referenced files within the selected companion folder are disclosed.
Missing companions
are disclosed before allowing a partial download. Unsupported main saves cannot
be exported as repaired checkpoints.

The selected ZIP contains the main save, its own companion folder, and a repair report,
ready to extract into the existing campaign folder. Other checkpoints, global
cache files and `Blizzard/Zones` are excluded. Working Zones may represent a
different checkpoint; loading a checkpoint restores its own snapshots.
Supported main saves and their companion directories receive the same
`_repaired` name. Filename and folder collisions share `_repaired_2`,
`_repaired_3`, etc., so an orphan destination directory cannot be overwritten.
Already paired bundles retain their names; older repaired filenames using an
original companion directory receive a fresh pair. Map snapshot filenames stay
fixed. All path changes and serialized string edits appear in the repair report.
Close the game, back up the entire campaign folder, and extract the output into
the original folder. Main checkpoint files can sit alongside their originals,
with the new matching companion directory. Original unsuffixed bundles can
remain alongside the repaired pair.
Filename collision checks include unselected checkpoints in the chosen folder.
Load a `_repaired` checkpoint and test travel before saving under
a new name. Renamed main saves were used during the recovered playthrough;
the browser export's naming and preserved paths are checked programmatically.

Large bundles are processed file by file, with one expanded save block in
memory at a time. Each selected checkpoint bundle is limited to 1 GB and 5,000
files; the whole folder can be larger. Duplicate paths, traversal paths,
corrupt containers, and unknown supported-map
revisions are rejected. The downloaded ZIP uses stored entries because game
saves are already compressed.

## Develop and test

Requires Node.js 24 or later.

```sh
npm ci
npm run build
npm test
npm start
```

Open http://127.0.0.1:4173. `dist/` is the self-contained deployable site.

For private, local verification against real saves and the independently
generated Python repair, the environment variable `FORSAKEN_RECOVERY_ROOT`
should point to the workshop's local recovery
output folder. Then run `npm test`. The local browser check accepts
`FORSAKEN_CAMPAIGN_ROOT` to verify folder listing, checkpoint selection, original
reference discovery and subset export against a real campaign folder. Unit
checks also use multi-gigabyte file metadata with reads forbidden to verify that
unselected saves are not loaded. No real saves are committed or uploaded.

## GitHub Pages

Push this repository to `XPlay1990/forsaken-save-repair`. In Settings → Pages,
choose **GitHub Actions** as the publishing source. The included workflow tests,
builds, and deploys only `dist/`. Relative asset URLs work on a repository Pages
URL such as `https://xplay1990.github.io/forsaken-save-repair/`.

## Add a later act or patch

The development checklist lives in `todo.md`, which is excluded from the
published site. The user interface focuses on bundle selection, prominent
folder-location guidance (including OneDrive), and upload/restore instructions.
Arcane Sanctuary
(`UndeadRE01_05`) has a verified 3.0.1 reference checksum, but its 3.0.0 checksum
is still missing, so it is named in results and preserved unchanged. Remaining
Act One areas and Acts Two and Three are pending. The display label for an
unsupported map never enables a repair; only verified old/current pairs in
`src/profiles.mjs` do. An unsupported companion's path migration does not enable
or imply a map-checksum repair.

The Warcraft-inspired theme uses original SVG stone texture, a citadel
silhouette, and a bronze crest; it includes no extracted game artwork.

Extend the profile registry only with same-map current-patch donor checksums,
verified serialization layouts, and matching old revisions. Keep the repair
engine separate from profile data. Add native-zlib fixtures and independent
real-save comparisons, then confirm direct loading, inter-map travel, and a
new save in the actual game. Do not reuse an Act One checksum for another map
or infer checksums from the encrypted `.w3xd` archive.

Format/recovery provenance:

- https://www.reddit.com/r/warcraft3/comments/1x0hk8z/your_save_can_be_fixed_i_fixed_mine/
- https://us.forums.blizzard.com/en/warcraft3/t/how-i-managed-to-retrieve-my-save-files-after-patch/39600

The initial checksum pairs were independently extracted from locally created
3.0.1 donor saves and tested against preserved 3.0.0 companions. Only the
checksum metadata is distributed; donor save content is private.
