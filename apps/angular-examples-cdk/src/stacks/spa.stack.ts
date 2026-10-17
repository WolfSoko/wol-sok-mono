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
        // Federation files keep their names across releases but point at
        // hashed bundles, so a cached copy pins the old bundles. remoteEntry.json
        // is the shell's own import map, the manifests list the remotes. The
        // asset is rooted at the build output so the files keep their paths;
        // '!assets' re-includes the folder that '**' would skip as a whole.
        Source.asset(props.buildOutputPath, {
          exclude: [
            '**',
            '!remoteEntry.json',
            '!assets',
            '!assets/federation.manifest*.json',
          ],
        }),
      ],
      CacheControl.noCache()
    );
  }
}
