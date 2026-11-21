import { envOrDie } from '@wolsok/spa-cdk-stack';
import { App, Tags } from 'aws-cdk-lib';
import { createPortfolioStack } from './portfolio.stack';

const app = new App();

createPortfolioStack(app, 'dist/apps/portfolio');

const tags: Tags = Tags.of(app);
tags.add('app', 'Portfolio');
tags.add('version', envOrDie('RELEASE_VERSION'));
