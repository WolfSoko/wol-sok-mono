import { AFTERGLOW, AFTERGLOW_FADE_START } from '../wave-model';
import {
  FRONT_LINE_ALPHA,
  LIT_ALPHA,
  LIT_GROWTH,
  REST_ALPHA,
} from '../renderer';
import { WAVE_SHADER_HEADER } from './shader-program';
import { ECHO_STRENGTH } from './echo';

/** the value of `const float <name> = …;` in the shader header */
function glslConstant(name: string): number {
  const match = new RegExp(`const float ${name} = ([-\\d.e]+);`).exec(
    WAVE_SHADER_HEADER
  );
  if (match == null) {
    throw new Error(`${name} is not in the shader header`);
  }
  return Number(match[1]);
}

describe('shader header constants', () => {
  it.each([
    ['WS_REST_ALPHA', REST_ALPHA],
    ['WS_LIT_ALPHA', LIT_ALPHA],
    ['WS_LIT_GROWTH', LIT_GROWTH],
    ['WS_FRONT_LINE_ALPHA', FRONT_LINE_ALPHA],
    ['WS_AFTERGLOW', AFTERGLOW],
    ['WS_AFTERGLOW_FADE_START', AFTERGLOW_FADE_START],
    ['WS_ECHO_STRENGTH', ECHO_STRENGTH],
  ])('%s mirrors the TypeScript constant', (name, value) => {
    expect(glslConstant(name)).toBe(value);
  });

  it('holds no interpolation, so a bundler can drop unused shaders', () => {
    expect(WAVE_SHADER_HEADER).not.toContain('${');
  });
});
