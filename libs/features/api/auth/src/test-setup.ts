// setup-jest.ts
import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

import { ReadableStream } from 'web-streams-polyfill/polyfill';

setupZoneTestEnv();

if (typeof globalThis.ReadableStream === 'undefined') {
  globalThis.ReadableStream = ReadableStream as never;
}
