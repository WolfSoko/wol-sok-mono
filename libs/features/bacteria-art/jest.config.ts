// Node, no DOM and no Angular: the art is plain SVG text, drawn by the icon
// generators under tools/ and shown by the game.
module.exports = {
  displayName: 'feat-shared-bacteria-art',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  coverageDirectory: '../../../coverage/libs/features/bacteria-art',
};
