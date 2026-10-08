# Forsaken Save Repair

A static, browser-only recovery tool for **Warcraft III: Forsaken Kingdom,
the three verified Act One maps, patch 3.0.0 → 3.0.1 (build 24342)**. Select the complete campaign
folder, pick one checkpoint, and download its repaired bundle. A ZIP is also
supported as an optional whole-bundle workflow.

All save processing runs in a Web Worker on the player's computer. No save
uploads, telemetry, account login, remote APIs, CDN assets, or persistent storage
are used. GitHub Pages only serves the application files. Save data stays out of
this repository and its Actions artifacts.

## Supported repair

The initial profile contains exact, verified old/current checksum pairs for
Undercity, Capital City Ruins, and Tirisfal Glades. It updates the encoded
settings identity and the plain map-checksum field, retains the original save
build and gameplay payload, recompresses only the first block, and rebuilds the
container integrity checksums. Other compressed blocks are copied byte for byte.

Main-save loading, travel between all three maps, and saving again in Undercity
were confirmed by a player. This is one recovered playthrough, not proof that
every campaign script is compatible. Other Act One areas also need separately
verified donors before they can be added. The tool does **not** port saved quest or
item-drop scripts. Unknown checksums for a supported map block export rather
than guessing. Other acts are copied unchanged and identified in the report.

Select the `ForsakenKingdom` folder. The worker lists main save filenames using
metadata only; the collection's total size is not subject to the processing cap.
Pick a checkpoint to read just its main save and associated `Blizzard` folder.
The worker scans expanded save blocks for original companion-folder references,
including references split across block boundaries. These references take
precedence over the main filename, so renamed checkpoints can still find their
original snapshots. Companion snapshots can reference older snapshot folders;
those dependencies are followed recursively with cycle detection. Missing
referenced files are disclosed even if their containing folder exists.
Filename association (including removal of a recovery
suffix) is a fallback when no stored references were found. Missing companions
are disclosed before allowing a partial download. Unsupported main saves cannot
be exported as repaired checkpoints.

The selected ZIP contains the main save, its linked companions, and a repair report,
ready to extract into the existing campaign folder. Other checkpoints, global
cache files and `Blizzard/Zones` are excluded. Working Zones may represent a
different checkpoint; loading a checkpoint restores its own snapshots. The
optional whole-ZIP workflow retains all input files and relative paths.
Supported main saves receive `_repaired` before `.w3z`. Already suffixed
checkpoints keep their names; collisions use `_repaired_2`, `_repaired_3`, etc.
Unsupported main saves retain their names. All name changes appear in the
file checks and repair report. Companion folders and snapshot filenames retain
their paths: inspected saves contain serialized references such as
`Blizzard\\after_baron\\UndeadRE01_03.w3z`. Changing those paths would require
gameplay-payload changes beyond the verified checksum repair.
Close the game, back up the entire campaign folder, and extract the output into
the original folder. Main checkpoint files can sit alongside their originals,
but companion snapshots retain their paths and may replace existing files.
Filename collision checks include unselected checkpoints in the chosen folder.
Load a `_repaired` checkpoint and test travel before saving under
a new name. Renamed main saves were used during the recovered playthrough;
the browser export's naming and preserved paths are checked programmatically.

Large bundles are processed file by file, with one expanded save block in
memory at a time. Each selected checkpoint bundle is limited to 1 GB and 5,000
files; the whole folder can be larger. Whole-ZIP input is still limited to 1 GB.
ZIP64, encryption,
duplicate paths, traversal paths, corrupt containers, and unknown supported-map
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
`src/profiles.mjs` do.

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
