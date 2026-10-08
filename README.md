# Forsaken Save Repair

**Public beta · v0.1.0-beta.1.** Checksum conversion covers all installed maps;
gameplay verification remains limited to the Act One locations listed below.
See [release notes](CHANGELOG.md).

A static, browser-only recovery tool for **Warcraft III: Forsaken Kingdom,
all acts and the separate prologue, targeting patch 3.0.1 (build 24342)**. Use
pre-update saves. Select the complete campaign
folder, pick one checkpoint, and download its repaired bundle. Folder selection
is the only input workflow; repaired bundles download as ZIP files.

All save processing runs in a Web Worker on the player's computer. No save
uploads, telemetry, account login, remote APIs, CDN assets, or persistent storage
are used. GitHub Pages only serves the application files. Save data stays out of
this repository and its Actions artifacts.

## Supported repair

The profile contains archive-derived target checksums for all 20 installed maps.
The initial old/current observations for Undercity (including Trade Quarter),
Capital City Ruins, and Tirisfal Glades remain recorded for provenance.
Trade Quarter uses the same map identity as Undercity. The repair updates the encoded
settings identity and the plain map-checksum field, retains the original save
build and gameplay payload, recompresses only the first block for the identity
repair, and rebuilds the container integrity checksums.

Save filenames and companion directory names are preserved exactly. All
serialized folder references and every compressed block after
the identity block stay unchanged. An attempted folder migration passed binary
checks but the player reported a loading crash for `beforebaron_repaired`.
Folder migration is disabled; its engine compatibility remains unresolved.

Main-save loading, travel between all three maps, and saving again in Undercity
were confirmed by a player, including travel to Trade Quarter. The player also
reported a successful `beforebaron` playtest after reverting to checksum-only
browser exports. These are recovered playthroughs, not proof that
every campaign script is compatible. Additional maps are enabled for checksum
conversion and remain untested in game. The tool does **not** port saved quest or
item-drop scripts. On a recognized map, a validated save with any non-target
checksum is updated to that map's extracted 3.0.1 checksum; the source patch
cannot be inferred from the save serialization build. Use pre-3.0.1 saves only.
Later patches are unsupported. Unrecognized maps remain unchanged and are
identified in the report; unrecognized main maps cannot be exported as repaired
checkpoints. Invalid containers, mismatched identities and unrecognized save
formats still block conversion.

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

The report inventories every inspected save, including unsupported submaps:
relative filename, map path and ID, input/output map checksums, serialization
build and game-format identifiers, inspection status and missing companions.
Input and output checksums are kept separate so a repaired checksum is never
mistaken for a pre-patch reference. No gameplay data is included. After selecting
a checkpoint, **Download repair report** also works when conversion is blocked
or the main map is unsupported. An inspection-only report has no output checksum.
Unverifiable fields are null, rather than guessed. Reports from an original save
and a fresh post-patch save of the same map can identify candidate checksum
pairs; format validation and game testing are still required before support is
enabled. A report cannot restore a missing companion's saved progress.

`src/map-checksums.mjs` records target checksums for all 20 installed campaign
maps, including Acts One–Three and the separate prologue. They were extracted
from authenticated 3.0.1.24342 archives using the XOR/rotate calculation inspected
in the running engine; all six available current-patch donor checksums matched.
The calculation starts with the compiled Lua script's hash, then combines the
readable nonempty terrain, pathing, doodad, object and W3L members in engine order.
It does not use an ordinary archive CRC32 or the legacy common.j/blizzard.j seed.
The local extraction used the MIT
[w3xd-toolkit reader](https://github.com/mythic-p/w3xd-toolkit); no reader code,
game archives, license material or save content is distributed with the site.

The profile now enables all targets for the validated game identifier/version
and serialization builds 7000 and 7003. A source save supplies its own checksum;
it need not appear in the observed-old table. Reports distinguish
`sourceRevisionKnown` (checksum previously observed or already current) and
`mapGameTested` (actual player validation). These fields do not claim the source
patch or future-patch compatibility. Newly covered maps must not be described as
game-tested. Unknown maps stay byte-identical.

No recovery suffix or numbered filename is added. Existing input filenames,
including older suffixed exports, are preserved exactly. Reports record
`filenamesPreserved: true` and an empty `renamed` list.
Close the game, back up the entire campaign folder, and copy the ZIP contents
into the original folder, replacing the selected save and its companions. The
download itself does not change original files; copying the contents back does.
Use an original checkpoint as input: checksum-only conversion cannot undo a
previous experimental folder migration.
Load the checkpoint with its existing name and test travel before saving again.
The selected bundle excludes unselected checkpoints and preserves every save
path within the campaign folder.

Large bundles are processed file by file, with one expanded save block in
memory at a time. Each selected checkpoint bundle is limited to 1 GB and 5,000
files; the whole folder can be larger. Duplicate paths, traversal paths,
corrupt containers, mismatched identity records and unrecognized save formats
are rejected. The downloaded ZIP uses stored entries because game
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

For additional private Act Two/prologue native controls, set
`FORSAKEN_ALL_MAP_CONTROLS` to their local manifest before running tests. These
checks compare all first-block gameplay bytes, preserved save headers and
untouched compressed blocks; they do not constitute game playtests.

## GitHub Pages

Push this repository to `XPlay1990/forsaken-save-repair`. In Settings → Pages,
choose **GitHub Actions** as the publishing source. The included workflow tests,
builds, and deploys only `dist/`. Relative asset URLs work on a repository Pages
URL such as `https://xplay1990.github.io/forsaken-save-repair/`.

## Add a later act or patch

The development checklist lives in `todo.md`, which is excluded from the
published site. The user interface focuses on bundle selection, prominent
folder-location guidance (including OneDrive), and upload/restore instructions.
All installed targets, including Arcane Sanctuary, Cathedral, Silverpine Sprint,
Acts Two/Three and the prologue, are enabled. Outstanding work is actual-game
validation of newly covered areas. A naming label alone never supplies a target;
the checksum registry and validated format govern conversion.

`src/map-catalog.mjs` inventories the 20 installed campaign maps in build
3.0.1.24342: 15 Forsaken Kingdom maps and five maps for the separate prologue,
The Last Days of Lordaeron. Campaign/chapter titles come from campaign UI
metadata and English strings. Location labels come from loading-screen
filenames, with the naming source recorded for each entry and in reports.
This catalog supplies names only; it contains no checksum pairs and never
enables a repair. Lookup uses the complete campaign path to avoid matching
an identically named file in another campaign.

The Warcraft-inspired theme uses original SVG stone texture, a citadel
silhouette, and a bronze crest; it includes no extracted game artwork.

For a future patch, authenticate/decrypt its installed maps and verify the
engine's checksum calculation against several fresh same-map donors before
changing targets. Revalidate serialization layouts, native-zlib fixtures and
independent real-save comparisons. Confirm loading, inter-map travel and saving
in game; keep untested areas explicitly identified. Never substitute the raw
encrypted archive CRC32 for the engine's map checksum or reuse another map's
target. Keep the repair engine separate from profile data.

Format/recovery provenance:

- https://www.reddit.com/r/warcraft3/comments/1x0hk8z/your_save_can_be_fixed_i_fixed_mine/
- https://us.forums.blizzard.com/en/warcraft3/t/how-i-managed-to-retrieve-my-save-files-after-patch/39600

The initial checksum pairs were independently extracted from locally created
3.0.1 donor saves and tested against preserved 3.0.0 companions. Only the
checksum metadata is distributed; donor save content is private.
