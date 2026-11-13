// @vitest-environment node
import { readFileSync } from 'node:fs';

interface ProjectJson {
  targets: Record<string, { options: { command: string } }>;
}

const project = JSON.parse(
  readFileSync(new URL('../project.json', import.meta.url), 'utf8')
) as ProjectJson;

const projectOf = (target: string): string | undefined =>
  /--project (\S+)/.exec(project.targets[target].options.command)?.[1];

/**
 * The emulator specs (`test-emulator`) and the e2e's emulators
 * (`emulatoren`) run side by side on one Nx Cloud agent. The Firebase CLI
 * keeps one hub locator per project id, so each suite runs as a project of
 * its own.
 */
describe('the emulator suites', () => {
  it('run as projects of their own, both demo projects', () => {
    const specs = projectOf('test-emulator');
    const e2e = projectOf('emulatoren');

    expect(specs).toBe('demo-korbjaeger-test');
    expect(e2e).toBe('demo-korbjaeger');
    expect(specs).not.toBe(e2e);
  });
});
