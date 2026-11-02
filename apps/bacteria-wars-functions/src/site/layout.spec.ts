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

describe("the pages' faces", () => {
  it('are copied into /fonts by the game build, from files that exist', () => {
    // One asset entry a face, its glob the file's name.
    const copied = project.targets.esbuild.options.assets.flatMap((asset) =>
      typeof asset === 'string' || asset.output !== 'fonts'
        ? []
        : [{ file: asset.glob, input: asset.input }]
    );
    expect(copied.map(({ file }) => file).sort()).toEqual(
      SITE_FONTS.map(({ file }) => file).sort()
    );
    for (const { file, input } of copied) {
      expect(() => readFileSync(join(ROOT, input, file))).not.toThrow();
    }
  });
});
