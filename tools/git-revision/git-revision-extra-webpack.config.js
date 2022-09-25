const { DefinePlugin } = require('webpack');
const GitRevisionPlugin =
  require('git-revision-webpack-plugin').GitRevisionPlugin;

module.exports = (config, _options) => {
  config.plugins.push(
    new DefinePlugin({
      VERSION: JSON.stringify(new GitRevisionPlugin().version()),
    })
  );
  return config;
};
