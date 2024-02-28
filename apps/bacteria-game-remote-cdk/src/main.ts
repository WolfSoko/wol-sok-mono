import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, RemovalPolicy, Tags } from 'aws-cdk-lib';
import { SpaStack } from './stacks/spa.stack';

const app = new App();

const stackName = 'BacteriaGame';
new SpaStack(app, stackName, {
  env: {
    region: 'us-east-1',
    account: '088632064895',
  },
  buildOutputPath: 'dist/apps/bacteria-game-remote',
  domainName: 'bacteria-game.wolsok.de',
  bucketRemovalPolicy: RemovalPolicy.DESTROY,
});

const tags: Tags = Tags.of(app);
tags.add('app', 'BacteriaGame');
tags.add('version', envOrDie('RELEASE_VERSION'));
