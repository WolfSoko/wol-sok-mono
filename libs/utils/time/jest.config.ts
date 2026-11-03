export default {
  displayName: 'utils-time',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  transform: {
    '^.+\\.[tj]s$': [
      'ts-jest',
      {
        // The lib is an ES module for its consumers, but Jest runs CommonJS:
        // transpile each file to CommonJS regardless of the package's "type".
        isolatedModules: true,
        tsconfig: {
          module: 'commonjs',
          target: 'es2022',
          esModuleInterop: true,
          strict: true,
        },
      },
    ],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  coverageDirectory: '../../../coverage/libs/utils/time',
};
