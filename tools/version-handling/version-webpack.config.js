const { DefinePlugin } = require('webpack');
const { version } = require('../../version.json');
module.exports = function withVersionHandling(config, context) {
  return {
    plugins: [
      new DefinePlugin({
        VERSION: JSON.stringify(version),
      }),
    ],
  };
};
