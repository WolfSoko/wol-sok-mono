import nxEslintPlugin from '@nx/eslint-plugin';
import baseConfig from '../../../../eslint.config.mjs';
import baseConfig1 from '../../../../eslint.base.config.mjs';

export default [
  ...baseConfig,
  ...baseConfig1,
  ...nxEslintPlugin.configs['flat/angular'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/directive-selector': [
        'error',
        {
          type: 'attribute',
          prefix: 'lazyFeatGpuCalc',
          style: 'camelCase',
        },
      ],
      '@angular-eslint/component-selector': [
        'error',
        {
          type: 'element',
          prefix: 'lazy-feat-gpu-calc',
          style: 'kebab-case',
        },
      ],
    },
  },
  ...nxEslintPlugin.configs['flat/angular-template'],
  {
    files: ['**/*.ts'],
    rules: {
      '@angular-eslint/prefer-standalone': 'off',
    },
  },
];
