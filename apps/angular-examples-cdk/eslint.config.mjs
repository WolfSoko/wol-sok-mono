import baseConfig from '../../eslint.config.mjs';
import baseConfig1 from '../../eslint.base.config.mjs';
import eslintPluginCdk from 'eslint-plugin-cdk';

export default [
  ...baseConfig,
  ...baseConfig1,
  { plugins: { cdk: eslintPluginCdk } },
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
  { ignores: ['test-build-path/**'] },
];


