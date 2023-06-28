import { RemovalPolicy, Stack } from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import { BlockPublicAccess, BucketAccessControl } from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { BucketProps } from './bucket.props';

export class Bucket extends Stack {
  constructor(scope: Construct, id: string, props: BucketProps) {
    super(scope, id, props);
    const { buildOutputPath } = props;

    const websiteBucket = new s3.Bucket(this, 'rollAPolla', {
      bucketName: 'roll-a-polla',
      websiteIndexDocument: 'index.html',
      blockPublicAccess: BlockPublicAccess.BLOCK_ACLS,
      accessControl: BucketAccessControl.BUCKET_OWNER_FULL_CONTROL,
      publicReadAccess: true,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    new s3deploy.BucketDeployment(this, 'DeployApp', {
      sources: [s3deploy.Source.asset(buildOutputPath)],
      destinationBucket: websiteBucket,
    });
  }
}
