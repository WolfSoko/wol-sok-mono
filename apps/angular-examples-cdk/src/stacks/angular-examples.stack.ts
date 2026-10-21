import { SpaStack, SpaStackProps } from '@wolsok/spa-cdk-stack';
import { App, Duration } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';

export interface AngularExamplesStackProps extends SpaStackProps {
  /** Release version, served as version.json. */
  version: string;
}

export class AngularExamplesStack extends SpaStack {
  constructor(parent: App, name: string, props: AngularExamplesStackProps) {
    super(parent, name, props);

    this.spa.addExtraAssets(
      [
        Source.asset(props.buildOutputPath + '/fib-wasm', {
          exclude: ['**', '!optimized.wasm'],
        }),
      ],
      CacheControl.maxAge(Duration.days(1)),
      'application/wasm'
    );
    this.spa.addExtraAssets(
      [
        Source.jsonData('version.json', props.version),
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
