const { withModuleFederation } = require('@nrwl/angular/module-federation');
const moduleFederationConfig = require('./module-federation.config');
const withVersionHandling = require('../../tools/version-handling/version-webpack.config');
const { merge } = require('webpack-merge');

module.exports = async (config, context) => {
  const federatedModules = await withModuleFederation({
    config,
    ...moduleFederationConfig,
    remotes: [
      ['fourier-analysis-remote', '/fourier-analysis-remote'],
      ['bacteria-game-remote', '/bacteria-game-remote'],
    ],

    /*
     * Remote overrides for production.
     * Each entry is a pair of a unique name and the URL where it is deployed.
     *
     * e.g.
     * remotes: [
     *   ['app1', 'https://app1.example.com'],
     *   ['app2', 'https://app2.example.com'],
     * ]
     */
  });
  return merge(federatedModules(config, context), withVersionHandling());
};
