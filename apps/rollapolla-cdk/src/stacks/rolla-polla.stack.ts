import { RemovalPolicy, StackProps } from 'aws-cdk-lib';
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';

import { Construct } from 'constructs';

export interface RollAPollaStackProps extends StackProps {
  deployDirectory: string;
}

export class RollaPollaStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: RollAPollaStackProps) {
    super(scope, id, props);

    const websiteBucket = new s3.Bucket(this, 'rollAPolla', {
      bucketName: 'roll-a-polla',
      websiteIndexDocument: 'index.html',
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new s3deploy.BucketDeployment(this, 'DeployApp', {
      sources: [s3deploy.Source.asset(props.deployDirectory)],
      destinationBucket: websiteBucket,
    });
  }
}
