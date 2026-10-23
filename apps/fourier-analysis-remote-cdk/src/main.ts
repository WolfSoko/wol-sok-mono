import { envOrDie, SpaStack } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';

const app = new App();

const stackName = 'FourierAnalysis';
new SpaStack(app, stackName, {
  env: {
    region: 'eu-central-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/fourier-analysis-remote',
  domainName: 'fourier-analysis.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  extraAllowedOrigins: ['https://angularexamples.wolsok.de'],
  // The import map keeps its name across releases.
  noCacheFiles: ['remoteEntry.json'],
});

const tags: Tags = Tags.of(app);
tags.add('app', 'FourierAnalysis');
tags.add('version', envOrDie('RELEASE_VERSION'));
