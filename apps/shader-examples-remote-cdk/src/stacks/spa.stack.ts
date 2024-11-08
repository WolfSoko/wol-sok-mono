import { SpaConstruct, SpaProps } from '@wolsok/spa-cdk-stack';
import { App, Stack, StackProps } from 'aws-cdk-lib';

export class SpaStack extends Stack {
  constructor(parent: App, name: string, props: StackProps & SpaProps) {
    super(parent, name, props);

    new SpaConstruct(this, name, {
      domainName: props.domainName,
      buildOutputPath: props.buildOutputPath,
      bucketRemovalPolicy: props.bucketRemovalPolicy,
      extraAllowedOrigins: props.extraAllowedOrigins,
    });
  }
}
