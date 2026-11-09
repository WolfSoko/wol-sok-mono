// @vitest-environment node
import { compile, NodePackageImporter } from 'sass';
import { fileURLToPath } from 'node:url';
import { SYSTEMFARBEN } from './farbschema';

const WORKSPACE = fileURLToPath(new URL('../../../../../', import.meta.url));
const STYLES = fileURLToPath(new URL('../../styles.scss', import.meta.url));

describe('the system colours a Verein’s colours set', () => {
  it('are every one the theme emits as light-dark()', () => {
    const { css } = compile(STYLES, {
      importers: [new NodePackageImporter(WORKSPACE)],
      loadPaths: [`${WORKSPACE}node_modules`],
    });
    const imTheme = new Set(
      [...css.matchAll(/--mat-sys-([\w-]+):\s*light-dark\(/g)].map(
        ([, name]) => name
      )
    );

    expect([...imTheme].sort()).toEqual([...SYSTEMFARBEN].sort());
  });
});
