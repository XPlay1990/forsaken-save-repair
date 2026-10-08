# Forsaken Save Repair

A static, browser-only recovery tool for **Warcraft III: Forsaken Kingdom,
the three verified Act One maps, patch 3.0.0 → 3.0.1 (build 24342)**. Select the complete campaign
folder or a ZIP, inspect the files, and download a repaired bundle.

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

Select the entire `ForsakenKingdom` folder: visited areas have companion saves
inside `Blizzard`, and the working copies in `Blizzard/Zones` matter too.
The downloaded ZIP preserves filenames and directory structure. Close the
game, back up the existing campaign folder, extract the repaired files into
the original folder, and test loading and travel before saving under a new name.

Large bundles are processed file by file, with one expanded save block in
memory at a time. A bundle is limited to 1 GB and 5,000 files. ZIP64, encryption,
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
output folder. Then run `npm test`. No real saves are committed or uploaded.

## GitHub Pages

Push this repository to `XPlay1990/forsaken-save-repair`. In Settings → Pages,
choose **GitHub Actions** as the publishing source. The included workflow tests,
builds, and deploys only `dist/`. Relative asset URLs work on a repository Pages
URL such as `https://xplay1990.github.io/forsaken-save-repair/`.

## Add a later act or patch

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
