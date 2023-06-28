import { StackProps } from 'aws-cdk-lib';
import { IBucket } from 'aws-cdk-lib/aws-s3';

export interface NetworkStackProps extends StackProps {
  websiteBucket: IBucket;
  domainName: string;
}
