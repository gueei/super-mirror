# Super Mirror

Figma plugin for mirroring layers across a user-defined axis or standard directions.

## Features

### Mirror Modes

1. **Arbitrary Axis** — Mirror selected layers across a custom helper axis line
   - Select target layers plus one axis helper (LINE, single-segment VECTOR, or ultra-thin shape)
   - Axis helpers can be extracted from existing shapes

2. **Horizontal (Left/Right)** — Mirror across a vertical axis through the selection center
   - Just select the layers you want to mirror
   - No axis helper needed

3. **Vertical (Up/Down)** — Mirror across a horizontal axis through the selection center
   - Just select the layers you want to mirror
   - No axis helper needed

### Additional Features

- **Clone before mirror** — Creates a copy before applying the mirror transformation
- **Extract axis helper lines** — Extract axis lines from vectors and box-like shapes
- **Remove extracted axis lines** — Clean up axis helpers created by the plugin

## Usage

1. Open the plugin in Figma
2. Select a mirror mode:
   - **Arbitrary**: Select target layers plus one axis helper
   - **Horizontal/Vertical**: Select just the target layers
3. (Optional) Enable "Clone before mirror" to preserve originals
4. Click "Apply Mirror"

### Extracting Axis Helpers (Arbitrary Mode Only)

1. Select a single shape with extractable geometry
2. Click "Extract Axis Lines" to create helper lines from its edges or vector segments
3. Select the desired helper line along with your targets
4. Apply the mirror transformation

## Local Development

- Import `manifest.json` into Figma desktop via Development plugins
- Runtime entrypoints currently used by Figma:
  - `code.js`
  - `ui.html`

## Project Status

- Working prototype with arbitrary-axis, horizontal, and vertical mirroring
- Pre-publish cleanup in progress

## Planned Pre-Publish Work

- Finalize plugin name and listing copy
- Create icon and cover art
- Restore a clean TypeScript source-of-truth + build pipeline
- Run broader manual QA on frames, groups, text, vectors, and auto-layout
