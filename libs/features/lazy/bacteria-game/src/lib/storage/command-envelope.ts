import { commandExpiresAt } from '@wolsok/feat-shared-bacteria-engine';
import type * as dbSdk from 'firebase/firestore';

/** The SDK calls the envelope is built with. */
export type EnvelopeSdk = Pick<typeof dbSdk, 'serverTimestamp' | 'Timestamp'>;

/** The fields every command document carries (`COMMAND_ENVELOPE_KEYS`). */
export interface CommandEnvelope {
  uid: string;
  createdAt: dbSdk.FieldValue;
  expireAt: dbSdk.Timestamp;
}

/**
 * The envelope of a command document written by `uid` at `now`
 * (`replaySubmissions`, `replayCommands`, `adminCommands`, ADR 0011, 0012):
 * the writer, the server's time, which the rules check, and an end a day
 * ahead (`COMMAND_TTL_MS`), after which TTL takes what a failed function
 * left behind.
 */
export function commandEnvelope(
  sdk: EnvelopeSdk,
  uid: string,
  now: number
): CommandEnvelope {
  return {
    uid,
    createdAt: sdk.serverTimestamp(),
    expireAt: sdk.Timestamp.fromMillis(commandExpiresAt(now)),
  };
}
