import { FlatCompat } from '@eslint/eslintrc';
import baseConfig from './eslint.base.config.js';
import jsoncEslintParser from 'jsonc-eslint-parser';
import js from '@eslint/js';

import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

// Convert import.meta.url to a file path
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
});

export default [
  ...baseConfig,
  ...compat.extends('plugin:storybook/recommended'),
  { plugins: {} },
  {
    files: ['**/*.ts', '**/*.tsx', '', '**/*.js', '**/*.jsx'],
    ignores: ['**/eslint.config.{ts,js}'],
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
  {
    files: ['**/*.json'],
    rules: {
      '@nx/dependency-checks': [
        'error',
        {
          ignoredFiles: ['{projectRoot}/eslint.config.{js,cjs,mjs}'],
        },
      ],
    },
    languageOptions: {
      parser: jsoncEslintParser,
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
  {
    ignores: ['**/vite.config.*.timestamp*', '**/vitest.config.*.timestamp*'],
  },
];
