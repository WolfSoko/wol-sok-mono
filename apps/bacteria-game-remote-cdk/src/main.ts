import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Aws, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

const stackName = 'BacteriaGame';
new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: Aws.ACCOUNT_ID,
  },
  buildOutputPath: 'dist/apps/bacteria-game-remote',
  domainName: 'bacteria-game.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
  extraAllowedOrigins: ['https://angularexamples.wolsok.de'],
});

const tags: Tags = Tags.of(app);
tags.add('app', 'BacteriaGame');
tags.add('version', envOrDie('RELEASE_VERSION'));
