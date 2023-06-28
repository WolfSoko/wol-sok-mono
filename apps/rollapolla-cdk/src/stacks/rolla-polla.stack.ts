import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';
import { Bucket } from './bucket/bucket';

import { BucketProps } from './bucket/bucket.props';

export interface RollAPollaStackProps extends BucketProps, StackProps {
  buildOutputPath: string;
}

export class RollaPollaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RollAPollaStackProps) {
    super(scope, id, props);
    new Bucket(this, 'RollAPollaBucket', props);
  }
}
