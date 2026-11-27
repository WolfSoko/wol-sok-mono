/**
 * Builds the .blend of a scene of apps/bacteria-wars-cinematic from its
 * script: dist/bacteria-wars-cinematic/<name>/<name>.blend.
 *
 * Run `npx nx run bacteria-wars-cinematic:scene -- --scene dish_duel`;
 * without `--scene` it builds the first cinematic, `--all` every shot of the
 * reel (shots.json). A .blend newer than the project's Python files is kept;
 * `--force` builds it anyway.
 */
import { parseArgs } from 'node:util';
import { buildScene, DEFAULT_SCENE, shots } from './scenes';

const { values } = parseArgs({
  options: {
    scene: { type: 'string', default: DEFAULT_SCENE },
    all: { type: 'boolean', default: false },
    force: { type: 'boolean', default: false },
  },
});

for (const scene of values.all ? shots().reel : [values.scene]) {
  buildScene(scene, values.force);
}
