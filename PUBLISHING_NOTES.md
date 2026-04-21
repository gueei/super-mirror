# Publishing Notes

Before public release:
- finalize plugin name
- create plugin icon and listing cover image
- write short and long descriptions for Figma Community listing
- verify behavior on rotated shapes, vectors, text, groups, frames, instances, and auto-layout
- decide whether to keep runtime as flat JS/HTML or re-sync TypeScript source and build outputs
- add standard mirror modes (left/right and up/down) if desired for parity with simpler plugins
- create GitHub repository and push source

Current manifest is development-minimal and valid for local import:
- name
- id
- api
- main
- ui
- editorType

Open cleanup issue:
- `src/` TypeScript files are stale relative to the working `code.js` / `ui.html`
- old `dist/` artifacts and historical experiments should not be used as the source of truth until re-synced
