/**
 * What specs outside the game lib take from it, imported as
 * `@wolsok/feat-lazy-bac-game/testing`: the fake game cloud and the fake
 * Firebase SDK the admin area's specs run on. Specs only, never a build;
 * export more as a spec needs it.
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
