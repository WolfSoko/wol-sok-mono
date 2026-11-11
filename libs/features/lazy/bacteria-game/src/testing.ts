/**
 * What specs outside the game lib take from it, imported as
 * `@wolsok/feat-lazy-bac-game/testing`: the fake game cloud, the fake
 * Firebase SDK and its Auth users and tokens the admin area's specs run
 * on. Specs only, never a build; export more as a spec needs it.
 */
export { provideFakeGameCloud } from './testing/fake-game-cloud';
export {
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
  settleSnapshots,
  timestampAt,
} from './testing/fake-firebase-sdk';
export type { FakeDoc } from './testing/fake-firebase-sdk';
export {
  FAKE_AUTH_TIME,
  fakeToken,
  googleUser,
  guestUser,
} from './testing/fake-firebase-auth';
export type { FakeToken, FakeUser } from './testing/fake-firebase-auth';
