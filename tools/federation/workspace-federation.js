const {
  withNativeFederation,
  shareAll,
} = require('@angular-architects/native-federation/config');

/**
 * Shared Native Federation setup for the shell and all remotes.
 *
 * Keeping this in one place stops the four configs from drifting apart - a
 * package that has to be skipped in one of them has to be skipped in all of
 * them, otherwise the shell and a remote disagree about the import map.
 */
function workspaceFederation(config) {
  return withNativeFederation({
    ...config,

    shared: {
      // shareAll() returns a plain config object; the array form of its
      // `Config` type is only produced by share().
      // oxlint-disable-next-line typescript/no-misused-spread
      ...shareAll({
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      }),
      // p5 keeps global state per instance and breaks when two sketches share
      // one copy, so every federated app brings its own - the same exception
      // the webpack module federation config carried.
      p5: { singleton: false, strictVersion: false, requiredVersion: false },
      ...config.shared,
    },

    skip: [
      'rxjs/ajax',
      'rxjs/fetch',
      'rxjs/testing',
      'rxjs/webSocket',
      // lodash ships CommonJS only. Shared through the import map its named
      // exports are not visible to the importer ("does not provide an export
      // named 'isEqual'"), so let the bundler handle the interop instead.
      'lodash',
      // brace is CommonJS and its modes and themes are loaded through deep
      // subpaths ('brace/theme/monokai'), which the import map does not carry.
      'brace',
      // gpu.js resolves to its Node entry when shared, which drags in the
      // native `gl` addon and Node builtins. Bundled normally it picks up the
      // `browser` field (dist/gpu-browser.js) instead.
      'gpu.js',
      ...(config.skip ?? []),
    ],

    features: {
      // Only share packages that are actually imported at runtime.
      ignoreUnusedDeps: true,
      ...config.features,
    },
  });
}

module.exports = { workspaceFederation };
