const nxPreset = require('@nx/jest/preset').default;
module.exports = {
  ...nxPreset,
  coverageReporters: ['lcov'],
  modulePathIgnorePatterns: ['<rootDir>/e2e/'],
};
