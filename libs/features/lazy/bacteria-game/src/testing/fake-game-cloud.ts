import type { Provider } from '@angular/core';
import { GameCloud } from '../lib/storage/game-cloud';

/** The backends a spec may hand the game cloud. */
type Backend =
  | 'rooms'
  | 'social'
  | 'presence'
  | 'boards'
  | 'moderation'
  | 'ranked'
  | 'storage'
  | 'replays';

/** The backends a spec gives the fake game cloud, each as the cloud returns it. */
export type FakeGameBackends = Partial<{
  [K in Backend]: ReturnType<GameCloud[K]>;
}>;

/**
 * A game cloud for specs: a real {@link GameCloud} without a project, so
 * every backend left out is what the game has without one - no rooms,
 * social, presence, boards, moderation or ranked (null), and storage,
 * replays and toggles on this device - with the `backends` given instead.
 */
export function provideFakeGameCloud(
  backends: FakeGameBackends = {}
): Provider {
  return { provide: GameCloud, useFactory: () => fakeGameCloud(backends) };
}

function fakeGameCloud(backends: FakeGameBackends): GameCloud {
  const cloud = new GameCloud();
  for (const [name, backend] of Object.entries(backends)) {
    Object.defineProperty(cloud, name, {
      value: () => backend,
      writable: true,
      configurable: true,
    });
  }
  return cloud;
}
