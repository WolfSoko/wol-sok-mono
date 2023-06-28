import * as cdk from 'aws-cdk-lib';
import { Bucket } from './bucket/bucket';
import { RollaPollaStack, RollAPollaStackProps } from './rolla-polla.stack';

// First, mock the class
jest.mock('./bucket/bucket', () => {
  return {
    Bucket: jest.fn().mockImplementation(() => {
      console.log('Mocked!');
    }),
  };
});

describe('RollaPolla Stack', () => {
  let stack: RollaPollaStack;
  let props: RollAPollaStackProps = { buildOutputPath: 'test-build-path' };
  let app: cdk.App;

  beforeAll(() => {
    app = new cdk.App();
    props = { buildOutputPath: 'test-build-path' };
    stack = new RollaPollaStack(app, 'MyTestStack', props);
  });

  it('should call the bucket constructor', () => {
    expect(Bucket).toHaveBeenCalled();
  });

  it('should call the bucket with app, id, and props', () => {
    expect(Bucket).toHaveBeenCalledWith(expect.anything(), 'RollAPollaBucket', props);
  });
});
