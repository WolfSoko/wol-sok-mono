import {
  COMMAND_ENVELOPE_KEYS,
  COMMAND_TTL_MS,
} from '@wolsok/feat-shared-bacteria-engine';
import { commandEnvelope, type EnvelopeSdk } from './command-envelope';

describe('commandEnvelope', () => {
  const sdk = {
    serverTimestamp: () => 'server-time',
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
  } as unknown as EnvelopeSdk;

  it('names the writer, the server’s time and a day to live', () => {
    expect(commandEnvelope(sdk, 'ada', 1_000)).toEqual({
      uid: 'ada',
      createdAt: 'server-time',
      expireAt: { ms: 1_000 + COMMAND_TTL_MS },
    });
  });

  it('writes exactly the engine’s envelope keys', () => {
    expect(Object.keys(commandEnvelope(sdk, 'ada', 0))).toEqual([
      ...COMMAND_ENVELOPE_KEYS,
    ]);
  });
});
