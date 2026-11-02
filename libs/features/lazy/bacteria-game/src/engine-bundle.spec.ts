/**
 * @jest-environment node
 */
import { build } from 'esbuild';
import { join } from 'node:path';

/** Packages the engine entry point must never pull in (ADR 0011). */
const FORBIDDEN = ['@angular', '@ngrx', 'rxjs', 'firebase'];

describe('engine entry point', () => {
  it('bundles without Angular, NgRx, RxJS or Firebase', async () => {
    const result = await build({
      entryPoints: [join(__dirname, 'engine.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      metafile: true,
      write: false,
      logLevel: 'silent',
    });

    const inputs = Object.keys(result.metafile.inputs);
    expect(inputs.length).toBeGreaterThan(0);
    expect(
      inputs.filter((input) => FORBIDDEN.some((name) => input.includes(name)))
    ).toEqual([]);
    expect(inputs.filter((input) => input.includes('node_modules'))).toEqual(
      []
    );
  });
});
