import { envOrDie, SpaStack } from '@wolsok/spa-cdk-stack';
import { WORKSPACE_VERSION } from '@wolsok/utils-version';
import { App, Duration, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { CacheControl, Source } from 'aws-cdk-lib/aws-s3-deployment';

const app = new App();

const stackName = 'AngularExamples';
const stack = new SpaStack(app, stackName, {
  env: {
    region: 'eu-central-1',
    account: '088632064895',
  },
  // The CDK executors run from the workspace root.
  buildOutputPath: 'dist/apps/angular-examples',
  domainName: 'angularexamples.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  // Federation files keep their names across releases but point at hashed
  // bundles, so a cached copy pins the old bundles. remoteEntry.json is the
  // shell's own import map, the manifests list the remotes.
  noCacheFiles: ['remoteEntry.json', 'assets/federation.manifest*.json'],
  cacheOverrides: [
    {
      files: ['fib-wasm/optimized.wasm'],
      cacheControl: CacheControl.maxAge(Duration.days(1)),
      contentType: 'application/wasm',
    },
  ],
});
stack.spa.addExtraAssets(
  [Source.jsonData('version.json', WORKSPACE_VERSION)],
  CacheControl.noCache()
);

const tags: Tags = Tags.of(app);
tags.add('app', 'AngularExamples');
tags.add('version', envOrDie('RELEASE_VERSION'));
