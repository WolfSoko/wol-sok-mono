// Read by the native federation builder from disk, so no path aliases: the
// relative require is allowed for these files in .oxlintrc.json.
const {
  workspaceFederation,
} = require('../../tools/federation/workspace-federation');

module.exports = workspaceFederation({
  name: 'fourier-analysis-remote',

  exposes: {
    // Paths are resolved from the workspace root, not the project root.
    './Routes':
      './apps/fourier-analysis-remote/src/app/remote-entry/entry.routes.ts',
  },
});
