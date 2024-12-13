const nxPreset = require('@nx/jest/preset').default;
require('cross-fetch/polyfill');

module.exports = {
  ...nxPreset,
  coverageReporters: ['lcov', 'html', 'text-summary'],
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
};
