import { JestConfigWithTsJest } from 'ts-jest';

export default {
  displayName: 'nx-aws-cdk-v2-e2e',
  preset: '../../jest.preset.cjs',
  testEnvironment: 'node',
  // The e2e suite generates a throwaway Nx workspace and runs `nx` commands in it,
  // which is far slower than a unit test.
  testTimeout: 300000,
  coverageDirectory: '../../coverage/apps/nx-aws-cdk-v2-e2e',
} as JestConfigWithTsJest;
