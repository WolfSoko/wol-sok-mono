import * as cdk from 'aws-cdk-lib';
import { Bucket } from './bucket/bucket';
import { NetworkStack } from './network/network.stack';
import { RollaPollaStack, RollAPollaStackProps } from './rolla-polla.stack';

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
  let stack: RollaPollaStack;
  let props: RollAPollaStackProps;
  let app: cdk.App;

  beforeAll(() => {
    app = new cdk.App();
    props = {
      buildOutputPath: 'apps/rollapolla-cdk/test-build-path',
      domainName: 'test-domain',
    };
    stack = new RollaPollaStack(app, 'MyTestStack', props);
  });

  it('should call the bucket constructor', () => {
    expect(Bucket).toHaveBeenCalled();
  });

  it('should call the bucket with app, id, and props', () => {
    expect(Bucket).toHaveBeenCalledWith(expect.anything(), 'RollAPollaBucketStack', props);
  });

  it('should create the NetworkStack with app, id, and props', () => {
    expect(NetworkStack).toHaveBeenCalledWith(expect.anything(), 'RollAPollaNetworkStack', {
      domainName: 'test-domain',
      websiteBucket: 'created-bucket-ref',
    });
  });
});
