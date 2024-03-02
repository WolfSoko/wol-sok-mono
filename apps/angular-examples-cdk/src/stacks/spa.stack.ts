import { SpaConstruct, SpaProps } from '@wolsok/spa-cdk-stack';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
import * as path from 'path';

export class SpaStack extends Stack {
  constructor(parent: App, name: string, props: StackProps & SpaProps) {
    super(parent, name, props);

    const spa: SpaConstruct = new SpaConstruct(this, name, {
      domainName: props.domainName,
      buildOutputPath: props.buildOutputPath,
      bucketRemovalPolicy: props.bucketRemovalPolicy,
    });
    spa.addExtraAssets(Source.asset('version.json'));
  }
}
