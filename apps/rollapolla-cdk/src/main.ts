import { App } from 'aws-cdk-lib';
import { RollaPollaStack } from './stacks/rolla-polla.stack';

const app = new App();
new RollaPollaStack(app, 'RollaPolla', { buildOutputPath: 'dist/apps/rollapolla', domainName: 'rollapolla.com' });
