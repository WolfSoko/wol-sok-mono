const { withModuleFederation } = require('@nrwl/angular/module-federation');
const moduleFederationConfig = require('./module-federation.config');
const withVersionHandling = require('../../tools/version-handling/version-webpack.config');
const { merge } = require('webpack-merge');

module.exports = async (config, context) => {
  const federatedModules = await withModuleFederation({
    config,
    ...moduleFederationConfig,
  });

  return merge(federatedModules(config, context), withVersionHandling(config, context));
};
