import { JestConfigWithTsJest } from 'ts-jest';

export default {
  displayName: 'nx-aws-cdk-v2',
  preset: '../../../jest.preset.cjs',
  testEnvironment: 'node',
  coverageDirectory: '../../../coverage/libs/public/nx-aws-cdk-v2',
} as JestConfigWithTsJest;
