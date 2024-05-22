const { FlatCompat } = require('@eslint/eslintrc');
const baseConfig = require('../../../eslint.config.js');
const baseConfig1 = require('../../../eslint.base.config.js');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...baseConfig,
  ...baseConfig1,
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {},
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
  ...compat.config({ parser: 'jsonc-eslint-parser' }).map((config) => ({
    ...config,
    files: ['**/*.json'],
    rules: {
      ...config.rules,
      '@nx/dependency-checks': [
        'error',
        { ignoredFiles: ['{projectRoot}/esbuild.config.{js,ts,mjs,mts}'] },
      ],
    },
  })),
];
