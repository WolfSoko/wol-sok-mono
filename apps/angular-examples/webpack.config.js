const { withModuleFederation } = require('@nx/angular/module-federation');
const moduleFederationConfig = require('./module-federation.config');
const withVersionHandling = require('../../tools/version-handling/version-webpack.config');
const { merge } = require('webpack-merge');
const withGlslLoader = require('../../tools/glsl/with-glsl-loader');

/**
 * Webpack's configuration function.
 *
 * @async
 * @function
 * @param {webpack.Configuration} config - The initial webpack configuration.
 * @param {any} context - The context in which the webpack configuration is being created.
 * @return {Promise<webpack.Configuration>}
 */
module.exports = async (config, context) => {
  const federatedModules = await withModuleFederation({
    config,
    ...moduleFederationConfig,
  });

  let conf = merge(
    federatedModules(config),
    withVersionHandling(config, context),
    withGlslLoader
  );

  // This is a workaround for Error: can not use import.meta outside a module
  // by overriding the `scriptType` from `module` to `text/javascript` the error disappears
  // @see https://stackoverflow.com/questions/70135006/upgrade-angular-from-12-to-13-added-can-not-use-import-meta-outside-a-module
  return {
    ...conf,
    output: {
      ...conf.output,
      scriptType: 'text/javascript',
    },
  };
};
