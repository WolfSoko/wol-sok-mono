import { SpaConstruct, SpaProps } from '@wolsok/spa-cdk-stack';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { Source } from 'aws-cdk-lib/aws-s3-deployment';
// eslint-disable-next-line @nx/enforce-module-boundaries
import { version } from '../../../../version.json';

export class SpaStack extends Stack {
  constructor(parent: App, name: string, props: StackProps & SpaProps) {
    super(parent, name, props);

    const spa: SpaConstruct = new SpaConstruct(this, name, {
      domainName: props.domainName,
      buildOutputPath: props.buildOutputPath,
      bucketRemovalPolicy: props.bucketRemovalPolicy,
    });
    spa.addExtraAssets(Source.jsonData('version', version));
  }
}
