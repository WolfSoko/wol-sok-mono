import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';
import { CompressionStream, DecompressionStream } from 'node:stream/web';
import { TextDecoder, TextEncoder } from 'node:util';

setupZonelessTestEnv();

// The browsers have them, the test DOM does not: the links to a ghost need
// them to pack a run.
Object.assign(globalThis, {
  CompressionStream: globalThis.CompressionStream ?? CompressionStream,
  DecompressionStream: globalThis.DecompressionStream ?? DecompressionStream,
  TextEncoder: globalThis.TextEncoder ?? TextEncoder,
  TextDecoder: globalThis.TextDecoder ?? TextDecoder,
});
