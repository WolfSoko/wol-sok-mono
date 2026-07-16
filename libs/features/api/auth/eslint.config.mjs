import nxPlugin from '@nx/eslint-plugin';
import angular from 'angular-eslint';
import { FlatCompat } from '@eslint/eslintrc';
import baseConfig from '../../../../eslint.config.mjs';
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
  { files: ['**/*.ts'], processor: angular.processInlineTemplates },
  ...nxPlugin.configs['flat/angular'].map((config) => ({
    ...config,
    files: ['**/*.ts'],
    rules: {
      ...config.rules,
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'ftApiAuth',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'ft-api-auth',
          style: 'kebab-case',
        },
      ],
    },
  })),
  ...nxPlugin.configs['flat/angular-template'].map((config) => ({
    ...config,
    files: ['**/*.html'],
    rules: {
      ...config.rules,
    },
  })),
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
];
