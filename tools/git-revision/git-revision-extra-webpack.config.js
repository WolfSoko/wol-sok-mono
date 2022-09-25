const { DefinePlugin } = require('webpack');
const { version } = require('version.json');
console.log('Building version: ' + version);

module.exports = (config, _options) => {
  config.plugins.push(
    new DefinePlugin({
      VERSION: version,
    })
  );
  return config;
};
