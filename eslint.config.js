const { FlatCompat } = require('@eslint/eslintrc');
const baseConfig = require('./eslint.base.config.js');
const js = require('@eslint/js');

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

module.exports = [
  ...baseConfig,
  ...compat.extends('plugin:storybook/recommended'),
  { plugins: {} },
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
    rules: {
      '@nx/enforce-module-boundaries': [
        'error',
        {
          allow: [],
          depConstraints: [
            {
              sourceTag: 'app',
              onlyDependOnLibsWithTags: [
                'shared',
                'feature',
                'feature:lazy',
                'api',
                'type:remote',
              ],
            },
            {
              sourceTag: 'infra',
              onlyDependOnLibsWithTags: ['infra-shared'],
            },
            {
              sourceTag: 'infra-shared',
              onlyDependOnLibsWithTags: ['infra-shared'],
            },
            {
              sourceTag: 'e2e',
              onlyDependOnLibsWithTags: ['shared'],
            },
            {
              sourceTag: ' feature',
              onlyDependOnLibsWithTags: ['feat-shared', 'shared', 'api'],
            },
            {
              sourceTag: 'feature:lazy',
              onlyDependOnLibsWithTags: ['feat-shared', 'shared', 'api'],
            },
            {
              sourceTag: 'feat-shared',
              onlyDependOnLibsWithTags: ['shared', 'api'],
            },
            {
              sourceTag: 'shared',
              onlyDependOnLibsWithTags: ['shared', 'api'],
            },
            {
              sourceTag: 'api',
              onlyDependOnLibsWithTags: ['api'],
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {},
  },
  {
    files: ['**/*.js', '**/*.jsx'],
    rules: {},
  },
];
