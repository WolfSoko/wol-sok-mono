/**
 * The scenes of apps/bacteria-wars-cinematic: where their scripts, their
 * built .blend files and their films are, and how Blender builds one.
 *
 * A scene is named by its script in blender/scenes/ without the extension
 * (`dish_duel`); its work folder and its film take the name with dashes
 * (`dish-duel`). BLENDER is the Blender executable (default `blender` on the
 * PATH).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';

export const projectDir = resolve('apps/bacteria-wars-cinematic');
export const rendersDir = join(projectDir, 'renders');
const workRoot = resolve('dist/bacteria-wars-cinematic');

/** The scene built when none is named: the first cinematic. */
export const DEFAULT_SCENE = 'bacteria_fight';

/** Runs Blender in the background and returns what it printed. */
export function blender(args: string[]): string {
  return execFileSync(process.env['BLENDER'] ?? 'blender', ['-b', ...args], {
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  });
}

/** The script of a scene given by name (`dish_duel`) or as a path to a .py file. */
export function sceneScript(scene: string): string {
  const script = scene.endsWith('.py')
    ? resolve(scene)
    : join(projectDir, 'blender/scenes', `${scene}.py`);
  if (!existsSync(script)) {
    throw new Error(`no scene script ${script}`);
  }
  return script;
}

/** `blender/scenes/dish_duel.py` or `some/dish_duel.blend` -> `dish-duel`. */
export function sceneName(source: string): string {
  return basename(source)
    .replace(/\.(blend|py)$/, '')
    .replaceAll('_', '-');
}

/** Where a scene's .blend, frames and previews are kept, outside git. */
export function workDir(name: string): string {
  return join(workRoot, name);
}

export function sceneBlend(name: string): string {
  return join(workDir(name), `${name}.blend`);
}

/**
 * Builds a scene's .blend from its script, unless it is newer than every
 * Python file of the project (`force` builds it anyway). Returns the .blend.
 */
export function buildScene(scene: string, force = false): string {
  const script = sceneScript(scene);
  const blend = sceneBlend(sceneName(script));
  if (!force && existsSync(blend) && statSync(blend).mtimeMs > newestSource()) {
    console.log(`${blend} is up to date`);
    return blend;
  }
  console.log(`Building ${blend} from ${script}`);
  blender(['--factory-startup', '--python', script, '--', blend]);
  return blend;
}

/** The modification time of the newest tracked Python file below blender/. */
function newestSource(): number {
  const files = execFileSync(
    'git',
    ['ls-files', '--cached', '--others', '--exclude-standard', '--', '*.py'],
    { cwd: join(projectDir, 'blender'), encoding: 'utf8' }
  )
    .split('\n')
    .filter(Boolean);
  return Math.max(
    ...files.map((file) => statSync(join(projectDir, 'blender', file)).mtimeMs)
  );
}

interface Shots {
  /** The scenes of the feature reel, in the order they are cut. */
  reel: string[];
}

/** The shots listed in apps/bacteria-wars-cinematic/shots.json. */
export function shots(): Shots {
  return JSON.parse(
    readFileSync(join(projectDir, 'shots.json'), 'utf8')
  ) as Shots;
}
