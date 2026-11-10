import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REGION } from './config';

interface ProjectJson {
  targets: { deploy: { options: { commands: string[] } } };
}

const project = JSON.parse(
  readFileSync(join(__dirname, '../project.json'), 'utf8')
) as ProjectJson;

describe('the functions config', () => {
  // the deploy's images' cleanup policy belongs where the functions run
  it('sets the cleanup policy of the images in the functions’ region', () => {
    const [setPolicy] = project.targets.deploy.options.commands;

    expect(setPolicy).toContain('functions:artifacts:setpolicy');
    expect(setPolicy).toContain(`--location=${REGION} `);
  });
});
