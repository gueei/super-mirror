# Super Mirror

Figma plugin for mirroring layers across a user-defined axis.

Current features:
- Mirror selected layers across a helper axis line
- Clone before mirror
- Extract axis helper lines from vectors and box-like shapes
- Remove extracted axis helper lines created by the plugin

Planned features:
- Standard mirror modes (left/right and up/down)

Local development:
- Import `manifest.json` into Figma desktop via Development plugins
- Runtime entrypoints currently used by Figma:
  - `code.js`
  - `ui.html`

Project status:
- Working prototype / pre-publish cleanup in progress
- Plugin name may change before public release

Planned pre-publish work:
- finalize plugin name and listing copy
- create icon and cover art
- restore a clean TypeScript source-of-truth + build pipeline
- run broader manual QA on frames, groups, text, vectors, and auto-layout
