import * as cdk from 'aws-cdk-lib';
import { Bucket } from './bucket/bucket';
import { NetworkStack } from './network/network.stack';
import { AppStack, RollAPollaStackProps } from './app.stack';

// First, mock the class
jest.mock('./bucket/bucket', () => {
  return {
    Bucket: jest.fn().mockImplementation(() => ({
      bucketRef: 'created-bucket-ref',
    })),
  };
});
// First, mock the NetworkStack
jest.mock('./network/network.stack', () => {
  return {
    NetworkStack: jest.fn(),
  };
});

describe('RollaPolla Stack', () => {
  let stack: AppStack;
  let props: RollAPollaStackProps;
  let app: cdk.App;

  beforeAll(() => {
    app = new cdk.App();
    props = {
      buildOutputPath: 'apps/rollapolla-cdk/test-build-path',
      domainName: 'test-domain',
    };
    stack = new AppStack(app, 'MyTestStack', props);
  });

  it('should call the bucket constructor', () => {
    expect(Bucket).toHaveBeenCalled();
  });

  it('should call the bucket with app, id, and props', () => {
    expect(Bucket).toHaveBeenCalledWith(expect.anything(), 'BucketStack', props);
  });

  it('should create the NetworkStack with app, id, and props', () => {
    expect(NetworkStack).toHaveBeenCalledWith(expect.anything(), 'NetworkStack', {
      domainName: 'test-domain',
      websiteBucket: 'created-bucket-ref',
    });
  });
});
