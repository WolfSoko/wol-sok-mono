import { SpaConstruct, SpaProps } from '@wolsok/spa-cdk-stack';
import { App, Duration, Stack, StackProps } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';
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
    spa.addExtraAssets(
      [
        Source.asset(props.buildOutputPath + '/fib-wasm', {
          exclude: ['**', '!optimized.wasm'],
        }),
      ],
      CacheControl.maxAge(Duration.days(1)),
      'application/wasm'
    );
    spa.addExtraAssets(
      [
        Source.jsonData('version.json', version),
        Source.asset(props.buildOutputPath, {
          exclude: ['**', '!mf-manifest.json'],
        }),
        Source.asset(props.buildOutputPath, {
          exclude: ['**', '!mf-stats.json'],
        }),
        Source.asset(props.buildOutputPath + '/assets', {
          exclude: ['**', '!module-federation.manifest*.json'],
        }),
      ],
      CacheControl.noCache()
    );
  }
}
