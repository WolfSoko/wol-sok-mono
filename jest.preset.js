const nxPreset = require('@nx/jest/preset').default;
module.exports = {
  ...nxPreset,
  coverageReporters: ['lcov', 'html', 'text-summary'],
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
};
