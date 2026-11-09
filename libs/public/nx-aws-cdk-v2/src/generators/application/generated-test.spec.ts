import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import { runGeneratedTests } from '../../testing/generated-test';
import generator from './application';

describe('generated main.test.ts', () => {
  it('passes against the workspace aws-cdk-lib without validation warnings', async () => {
    const tree = createTreeWithEmptyWorkspace();
    await generator(tree, { name: 'starter', skipFormat: true });

    const run = await runGeneratedTests(tree, 'starter/src/main.test.ts');

    expect(run.names.length).toBeGreaterThan(0);
    expect(run.logged).not.toContain('CloudFormation-Validate');
  });
});
