# Release notes

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
