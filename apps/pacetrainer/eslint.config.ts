import nxPlugin from '@nx/eslint-plugin';
import angular from 'angular-eslint';
import { FlatCompat } from '@eslint/eslintrc';

import js from '@eslint/js';

import baseConfig from '../../eslint.config.mjs';

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
          prefix: 'pace',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'pace',
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
      // Newly enabled by the Angular ESLint v22 preset; preserve the previous lint baseline.
      '@angular-eslint/template/role-has-required-aria': 'off',
      '@angular-eslint/template/alt-text': 'off',
    },
  })),
  ...compat
    .config({ extends: ['plugin:playwright/recommended'] })
    .map((config) => ({
      ...config,
      files: ['e2e/**/*.{ts,js,tsx,jsx}'],
      rules: {
        ...config.rules,
        'playwright/no-standalone-expect': 'off',
        'playwright/expect-expect': 'off',
      },
    })),
];
