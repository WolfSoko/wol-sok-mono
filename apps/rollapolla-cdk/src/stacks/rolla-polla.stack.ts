import * as cdk from 'aws-cdk-lib';
import { StackProps } from 'aws-cdk-lib';

import { Construct } from 'constructs';
import { Bucket } from './bucket/bucket';

import { BucketProps } from './bucket/bucket.props';
import { NetworkStackProps } from './network/network-stack.props';
import { NetworkStack } from './network/network.stack';

export interface RollAPollaStackProps extends BucketProps, Pick<NetworkStackProps, 'domainName'>, StackProps {}

export class RollaPollaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RollAPollaStackProps) {
    super(scope, id, props);
    const bucket: Bucket = new Bucket(this, 'RollAPollaBucketStack', props);
    new NetworkStack(this, 'RollAPollaNetworkStack', {
      domainName: props.domainName,
      websiteBucket: bucket.bucketRef,
    });
  }
}
