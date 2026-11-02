import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { SITE_FONTS } from './layout';

/**
 * The pages load the game's faces from `/fonts`, which the game's build
 * copies there from Fontsource: every face they name must be copied.
 */
const ROOT = join(__dirname, '../../../..');
const project = JSON.parse(
  readFileSync(join(ROOT, 'apps/bacteria-game-remote/project.json'), 'utf8')
) as {
  targets: {
    esbuild: {
      options: {
        assets: (string | { glob: string; input: string; output: string })[];
      };
    };
  };
};

/**
 * The file names a glob of the assets names: its `{a,b}` alternatives
 * spelt out, the only pattern the font entries use.
 */
function expand(glob: string): string[] {
  const group = /\{([^{}]*)\}/.exec(glob);
  if (group === null) {
    return [glob];
  }
  const [whole, list = ''] = group;
  return list
    .split(',')
    .flatMap((choice) => expand(glob.replace(whole, choice)));
}

describe("the pages' faces", () => {
  it('are copied into /fonts by the game build, from files that exist', () => {
    const copied = project.targets.esbuild.options.assets.flatMap((asset) =>
      typeof asset === 'string' || asset.output !== 'fonts'
        ? []
        : expand(asset.glob).map((file) => ({ file, input: asset.input }))
    );
    expect(copied.map(({ file }) => file).sort()).toEqual(
      SITE_FONTS.map(({ file }) => file).sort()
    );
    for (const { file, input } of copied) {
      expect(() => readFileSync(join(ROOT, input, file))).not.toThrow();
    }
  });
});
