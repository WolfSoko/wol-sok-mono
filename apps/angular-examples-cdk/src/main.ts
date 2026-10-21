import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Duration, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { CacheControl } from 'aws-cdk-lib/aws-s3-deployment';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { AngularExamplesStack } from './stacks/angular-examples.stack';

// The CDK executors run from the workspace root.
const { version } = JSON.parse(
  readFileSync(join(process.cwd(), 'version.json'), 'utf8')
) as { version?: unknown };
if (typeof version !== 'string') {
  throw new Error('version.json has no string "version"');
}

const app = new App();

const stackName = 'AngularExamples';
new AngularExamplesStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
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
  version,
});

const tags: Tags = Tags.of(app);
tags.add('app', 'AngularExamples');
tags.add('version', envOrDie('RELEASE_VERSION'));
