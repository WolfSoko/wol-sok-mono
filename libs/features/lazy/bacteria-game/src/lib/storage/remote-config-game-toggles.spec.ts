import { firstValueFrom } from 'rxjs';
import type { RemoteConfigConnection } from './firebase-connection';
import {
  readToggles,
  RemoteConfigGameToggles,
} from './remote-config-game-toggles';

type Source = 'static' | 'default' | 'remote';

/** Remote Config holding `values`: a parameter it lacks reads as static. */
function remoteConfig(
  values: Record<string, [string, Source]>
): RemoteConfigConnection {
  return {
    config: {},
    sdk: {
      getValue: (_config: unknown, key: string) => {
        const [text, source] = values[key] ?? ['', 'static'];
        return { asString: () => text, getSource: () => source };
      },
    },
  } as unknown as RemoteConfigConnection;
}

describe('readToggles', () => {
  it('reads the booleans the admin area publishes, under the toggles’ names', () => {
    expect(
      readToggles(
        remoteConfig({
          matchmaking: ['false', 'remote'],
          leaderboards: ['true', 'remote'],
          deterministicSimulation: ['FALSE', 'remote'],
        })
      )
    ).toEqual({
      matchmaking: false,
      leaderboards: true,
      deterministicSimulation: false,
    });
  });

  it('leaves out what is not set, what is not a boolean and what it does not know', () => {
    expect(
      readToggles(
        remoteConfig({
          // The SDK's static value: no such parameter.
          rankedDaily: ['false', 'static'],
          rankedEndless: ['maybe', 'remote'],
          somethingElse: ['false', 'remote'],
        })
      )
    ).toEqual({});
  });
});

describe('RemoteConfigGameToggles', () => {
  it('fetches once, on the first watch, for every watcher', async () => {
    const fetch = jest.fn(async () =>
      remoteConfig({ matchmaking: ['false', 'remote'] })
    );
    const toggles = new RemoteConfigGameToggles(fetch);
    expect(fetch).not.toHaveBeenCalled();

    expect(await firstValueFrom(toggles.watch())).toEqual({
      matchmaking: false,
    });
    expect(await firstValueFrom(toggles.watch())).toEqual({
      matchmaking: false,
    });
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('tells nothing where Remote Config cannot run', async () => {
    const toggles = new RemoteConfigGameToggles(async () => null);

    expect(await firstValueFrom(toggles.watch())).toEqual({});
  });

  it('tells nothing, and never errors, when Remote Config fails', async () => {
    const warn = jest
      .spyOn(console, 'warn')
      .mockImplementation(() => undefined);
    const toggles = new RemoteConfigGameToggles(() =>
      Promise.reject(new Error('blocked'))
    );

    expect(await firstValueFrom(toggles.watch())).toEqual({});
    expect(warn).toHaveBeenCalled();
  });
});
