import { setupZonelessTestEnv } from 'jest-preset-angular/setup-env/zoneless';
setupZonelessTestEnv();

import { ReadableStream } from 'web-streams-polyfill/polyfill';

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream as never;
}
