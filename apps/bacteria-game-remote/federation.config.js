/* eslint-disable @nx/enforce-module-boundaries -- federation.config.js is
   read by the native federation builder from disk, so it cannot use the
   workspace's TypeScript path aliases. */
const {
  workspaceFederation,
} = require('../../tools/federation/workspace-federation');

module.exports = workspaceFederation({
  name: 'bacteria-game-remote',

  exposes: {
    // Paths are resolved from the workspace root, not the project root.
    './Routes':
      './apps/bacteria-game-remote/src/app/remote-entry/entry.routes.ts',
  },
});
