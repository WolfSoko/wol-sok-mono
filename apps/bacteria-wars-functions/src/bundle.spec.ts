import { build } from 'esbuild';
import { join } from 'node:path';

/**
 * The engine stays out of the functions' main chunk (ADR 0011): every
 * module but `engine.ts` imports only its types, and `loadEngine()` imports
 * it on first use, so a function that never reads a replay does not load it
 * on a cold start. Built like the `build` target: bundled, split, ESM.
 */
describe('the functions bundle', () => {
  it('keeps the engine in a chunk of its own', async () => {
    const result = await build({
      entryPoints: [join(__dirname, 'main.ts')],
      bundle: true,
      splitting: true,
      platform: 'node',
      format: 'esm',
      outdir: join(__dirname, '../../../tmp/bacteria-wars-functions-bundle'),
      external: ['firebase-functions', 'firebase-admin'],
      tsconfig: join(__dirname, '../tsconfig.app.json'),
      metafile: true,
      write: false,
      logLevel: 'silent',
    });
    const outputs = Object.entries(result.metafile.outputs);
    const main = outputs.find(([, output]) =>
      output.entryPoint?.endsWith('main.ts')
    );
    expect(main).toBeDefined();
    const mainInputs = Object.keys(main?.[1].inputs ?? {});
    expect(
      mainInputs.filter((input) => input.includes('bacteria-game/src'))
    ).toEqual([]);
    expect(
      outputs.some(([, output]) =>
        Object.keys(output.inputs).some((input) =>
          input.includes('bacteria-game/src/engine.ts')
        )
      )
    ).toBe(true);
  });
});
