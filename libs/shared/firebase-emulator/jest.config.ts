// Node: the helpers run in the Cloud Functions' and the apps' emulator specs.
module.exports = {
  displayName: 'shared-firebase-emulator',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js'],
  coverageDirectory: '../../../coverage/libs/shared/firebase-emulator',
};
