import { SpaConstruct, SpaProps } from '@wolsok/spa-cdk-stack';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';

export class SpaStack extends Stack {
  constructor(parent: App, name: string, props: StackProps & SpaProps) {
    super(parent, name, props);

    const buildOutputPath: string = props.buildOutputPath;
    const spa: SpaConstruct = new SpaConstruct(this, name, {
      domainName: props.domainName,
      buildOutputPath,
      bucketRemovalPolicy: props.bucketRemovalPolicy,
      extraAllowedOrigins: props.extraAllowedOrigins,
    });

    spa.addExtraAssets(
      [
        Source.asset(buildOutputPath, {
          exclude: ['**', '!mf-manifest.json'],
        }),
        Source.asset(buildOutputPath, {
          exclude: ['**', '!mf-stats.json'],
        }),
      ],
      CacheControl.noCache()
    );
  }
}
