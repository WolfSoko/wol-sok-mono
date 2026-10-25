/* eslint-disable @nx/enforce-module-boundaries -- federation.config.js is
   read by the native federation builder from disk, so it cannot use the
   workspace's TypeScript path aliases. */
const {
  workspaceFederation,
} = require('../../tools/federation/workspace-federation');

module.exports = workspaceFederation({
  name: 'bacteria-game-remote',

  // Material's table, tabs and toolbar are used only by the admin area
  // (`/admin` in app.routes.ts, never exposed): pruned from the shared
  // packages, their imports would have nothing to load. Skipped, the admin
  // chunk bundles them. Only this app skips them, which leaves the shell's
  // import map as it is - the shell never loads `/admin`. (Keeping all of
  // Material's secondaries instead broke the shell's dev build, whose Sass
  // then could not resolve `@use '@angular/material'`.)
  skip: [
    '@angular/material/table',
    '@angular/material/tabs',
    '@angular/material/toolbar',
  ],

  exposes: {
    // Paths are resolved from the workspace root, not the project root.
    './Routes':
      './apps/bacteria-game-remote/src/app/remote-entry/entry.routes.ts',
  },
});
