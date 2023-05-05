const { withModuleFederation } = require('@nx/angular/module-federation');
const moduleFederationConfig = require('./module-federation.config');
const withVersionHandling = require('../../tools/version-handling/version-webpack.config');
const { merge } = require('webpack-merge');

module.exports = async (config, context) => {
  const federatedModules = await withModuleFederation({
    config,
    ...moduleFederationConfig,
  });

  let conf = merge(federatedModules(config, context), withVersionHandling(config, context));

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
