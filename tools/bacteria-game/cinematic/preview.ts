/**
 * Quick stills of a scene of apps/bacteria-wars-cinematic on this machine,
 * to judge a shot before it goes to the render farm: builds the scene where
 * its .blend is out of date and renders the frames named, small and with few
 * samples, into dist/bacteria-wars-cinematic/<name>/previews.
 *
 * Run `npx nx run bacteria-wars-cinematic:preview -- --scene dish_duel
 * --frames 1,60,120`. `--frames poster` (the default) takes the scene's
 * poster frame; `--samples` (48) and `--percent` (50, of 1920 x 1080) set
 * the quality.
 */
import { join } from 'node:path';
import { parseArgs } from 'node:util';
import {
  blender,
  buildScene,
  DEFAULT_SCENE,
  projectDir,
  sceneName,
  sceneScript,
  workDir,
} from './scenes';

const { values } = parseArgs({
  options: {
    scene: { type: 'string', default: DEFAULT_SCENE },
    frames: { type: 'string', default: 'poster' },
    samples: { type: 'string', default: '48' },
    percent: { type: 'string', default: '50' },
  },
});

const blend = buildScene(values.scene);
const out = join(workDir(sceneName(sceneScript(values.scene))), 'previews');
const log = blender([
  blend,
  '--python',
  join(projectDir, 'blender/render/preview.py'),
  '--',
  out,
  values.frames,
  values.samples,
  values.percent,
]);
console.log(
  log
    .split('\n')
    .filter((line) => line.startsWith('Saved '))
    .join('\n')
);
