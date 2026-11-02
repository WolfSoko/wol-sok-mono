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
    const copied = project.targets.esbuild.options.assets
      .filter((asset) => typeof asset !== 'string' && asset.output === 'fonts')
      .flatMap((asset) => {
        if (typeof asset === 'string') {
          return [];
        }
        const pattern = new RegExp(
          `^${asset.glob
            .replace(/[.]/g, '\\.')
            .replace(
              /\{([^}]+)\}/g,
              (_, list: string) => `(${list.split(',').join('|')})`
            )}$`
        );
        return SITE_FONTS.filter(({ file }) => pattern.test(file)).map(
          ({ file }) => join(ROOT, asset.input, file)
        );
      });
    expect(copied).toHaveLength(SITE_FONTS.length);
    for (const file of copied) {
      expect(() => readFileSync(file)).not.toThrow();
    }
  });
});
