const {
  withNativeFederation,
  fromPackageJson,
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

    // Native federation infers the platform of *every* shared bundle from the
    // shared dependency names: a single `@angular/ssr` or
    // `@angular/platform-server` entry flips the default to 'node'. Both are
    // root dependencies here (for pacetrainer and rollapolla-analog, neither of
    // which is federated), so without this the shared packages would be bundled
    // with esbuild's Node export conditions - firebase/firestore then resolves
    // to its Node build and imports the builtin `util`, which an import map
    // cannot provide. None of the federated apps is server-rendered.
    platform: config.platform ?? 'browser',

    shared: {
      // fromPackageJson() returns a plain config object; the array form of its
      // `Config` type is only produced by share().
      // oxlint-disable-next-line typescript/no-misused-spread
      ...fromPackageJson({
        singleton: true,
        strictVersion: true,
        requiredVersion: 'auto',
      })
        // `ignoreUnusedDeps` prunes the import map down to what the *exposed*
        // module imports, but esbuild keeps every subpath of an external
        // package external. The remotes only reach
        // '@angular/platform-browser/animations' from their standalone
        // bootstrap, so the secondary was pruned while its import survived and
        // a remote served on its own port failed to bootstrap. Keeping the
        // secondaries of @angular/platform-browser restores it.
        .patch(['@angular/platform-browser'], {
          includeSecondaries: { keepAll: true },
        })
        .get(),
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
