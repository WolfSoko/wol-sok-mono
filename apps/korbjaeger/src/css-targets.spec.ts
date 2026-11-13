// @vitest-environment node
import { readFileSync } from 'node:fs';
import { cssTargets } from '../deploy/css-targets';

describe('the CSS targets of the build', () => {
  it('names the oldest version of each browser browserslist resolves to', () => {
    expect(
      cssTargets([
        'chrome 155',
        'chrome 154',
        'edge 154',
        'firefox 158',
        'firefox 153',
        'ios_saf 26.0',
        'ios_saf 27.0',
        'safari 26.3',
        'safari 27',
      ])
    ).toEqual(['chrome154', 'edge154', 'firefox153', 'ios26.0', 'safari26.3']);
  });

  it('names Opera where browserslist resolves to it', () => {
    expect(cssTargets(['chrome 130', 'opera 81', 'opera 83'])).toEqual([
      'chrome130',
      'opera81',
    ]);
  });

  it('builds again when the workspace’s browsers change', () => {
    const project = JSON.parse(
      readFileSync(new URL('../project.json', import.meta.url), 'utf8')
    ) as { targets: Record<string, { inputs?: string[] }> };

    expect(project.targets['build-app'].inputs).toContain(
      '{workspaceRoot}/.browserslistrc'
    );
  });

  it('leaves out browsers the minifier has no target for', () => {
    expect(cssTargets(['op_mini all', 'chrome 154', 'kaios 3.1'])).toEqual([
      'chrome154',
    ]);
  });

  it('takes the first version of a range', () => {
    expect(cssTargets(['ios_saf 18.5-18.7'])).toEqual(['ios18.5']);
  });

  it('is what the build uses, from the workspace’s .browserslistrc', () => {
    expect(
      readFileSync(new URL('../vite.config.ts', import.meta.url), 'utf8')
    ).toContain('cssTarget: cssTargets(browserslist())');
  });
});
