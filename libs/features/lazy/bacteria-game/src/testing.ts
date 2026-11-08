/**
 * What specs outside the game lib take from it, imported as
 * `@wolsok/feat-lazy-bac-game/testing`: the fake Firebase SDK the admin
 * area's specs run on. Specs only, never a build.
 */
export {
  FAKE_SERVER_STAMP,
  FAKE_SERVER_TIME,
  FakeBytes,
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
  settleSnapshots,
  timestampAt,
} from './testing/fake-firebase-sdk';
export type {
  FakeDoc,
  FakeFirebaseOptions,
  FakeWrite,
} from './testing/fake-firebase-sdk';
export {
  FakeRealtimeDatabase,
  RTDB_SERVER_TIMESTAMP,
} from './testing/fake-realtime-database';
export type { FakeValueWrite } from './testing/fake-realtime-database';
export {
  FakeFirebaseAuth,
  googleUser,
  guestUser,
} from './testing/fake-firebase-auth';
export type { FakeToken, FakeUser } from './testing/fake-firebase-auth';
