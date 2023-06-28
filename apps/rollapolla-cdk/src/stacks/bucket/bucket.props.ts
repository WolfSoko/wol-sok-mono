import { StackProps } from 'aws-cdk-lib';

export interface BucketProps extends StackProps {
  buildOutputPath: string;
}
