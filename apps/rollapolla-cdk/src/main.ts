import { App } from 'aws-cdk-lib';
import { RollaPollaStack } from './stacks/rolla-polla.stack';

const app = new App();
new RollaPollaStack(app, 'RollaPolla', { deployDirectory: 'dist/apps/rollapolla' });
