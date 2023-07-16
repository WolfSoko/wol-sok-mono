import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { Bucket } from './bucket/bucket';

import { BucketProps } from './bucket/bucket.props';
import { NetworkStackProps } from './network/network-stack.props';
import { NetworkStack } from './network/network.stack';

type PublicNetworkProps = Pick<NetworkStackProps, 'domainName'>;

export interface RollAPollaStackProps extends BucketProps, PublicNetworkProps, StackProps {}

export class AppStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RollAPollaStackProps) {
    super(scope, id, props);

    const { bucketRef: websiteBucket } = new Bucket(this, 'BucketStack', props);
    const { domainName } = props;

    new NetworkStack(this, 'NetworkStack', {
      domainName,
      websiteBucket,
    });
  }
}
