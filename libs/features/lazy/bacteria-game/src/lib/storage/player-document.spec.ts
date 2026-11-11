import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { LateGameStorage } from '../../testing/late-game-storage';
import { GameAccount } from './game-account';
import { DeviceStorage, GameStorage } from './game-storage';
import {
  PlayerDocument,
  playerDocument,
  PlayerDocumentOptions,
} from './player-document';

const KEY = 'bacteria-game.badges';

/** A set of badges: it can only gain, as the player's data merges. */
type Badges = readonly string[];

const NO_BADGES: Badges = [];

function union(a: Badges, b: Badges): Badges {
  return [...new Set([...a, ...b])].sort();
}

const BADGES: PlayerDocumentOptions<Badges> = {
  key: KEY,
  parse: (stored) =>
    Array.isArray(stored)
      ? stored.filter((badge) => typeof badge === 'string')
      : NO_BADGES,
  empty: NO_BADGES,
  merge: union,
  adopt: union,
  equal: (a, b) => a.join() === b.join(),
};

describe('playerDocument', () => {
  let account: FakeGameAccount;
  let device: LateGameStorage;

  interface Setup extends Partial<PlayerDocumentOptions<Badges>> {
    /** What the guest's storage holds. */
    stored?: Record<string, unknown>;
    /** What the device's storage holds. */
    onDevice?: Record<string, unknown>;
    cloud?: boolean;
  }

  function create({
    stored = {},
    onDevice = {},
    cloud = true,
    ...options
  }: Setup = {}): PlayerDocument<Badges> {
    TestBed.resetTestingModule();
    account = new FakeGameAccount('guest');
    Object.defineProperty(account, 'cloud', { value: cloud });
    account.seed('guest', stored);
    device = new LateGameStorage(onDevice);
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: device },
      ],
    });
    return TestBed.runInInjectionContext(() =>
      playerDocument({ ...BADGES, ...options })
    );
  }

  function add(document: PlayerDocument<Badges>, badge: string): void {
    const next = union(document.value(), [badge]);
    document.apply(next, (stored) => union(stored, next));
  }

  it('holds the empty value until the storage answers, then the stored one', () => {
    const document = create({ stored: { [KEY]: ['gold'] } });

    expect(document.loaded()).toBe(false);
    expect(document.value()).toEqual([]);
    account.flush();
    expect(document.loaded()).toBe(true);
    expect(document.value()).toEqual(['gold']);
  });

  it('merges what the storage tells into what changed here meanwhile', () => {
    const document = create({ stored: { [KEY]: ['gold'] } });

    add(document, 'silver');
    expect(document.value()).toEqual(['silver']);
    account.flush();

    expect(document.value()).toEqual(['gold', 'silver']);
    expect(account.storageOf('guest').stored(KEY)).toEqual(['gold', 'silver']);
  });

  it('follows what another tab stores', () => {
    const document = create();
    account.flush();

    void account.storageOf('guest').update(KEY, () => ['bronze']);
    account.flush();

    expect(document.value()).toEqual(['bronze']);
  });

  it('keeps the value it holds for a stored value equal to it', () => {
    const document = create({ stored: { [KEY]: ['gold'] } });
    account.flush();
    const held = document.value();

    void account.storageOf('guest').update(KEY, () => ['gold']);
    account.flush();

    expect(document.value()).toBe(held);
  });

  it('reads an unreadable stored value as empty', () => {
    const document = create({ stored: { [KEY]: { not: 'badges' } } });
    account.flush();

    expect(document.value()).toEqual([]);
    expect(document.loaded()).toBe(true);
  });

  describe('when another player takes over', () => {
    it("starts over from the next player's value", () => {
      const onSwitch = jest.fn();
      const document = create({ stored: { [KEY]: ['gold'] }, onSwitch });
      account.flush();
      account.seed('ada', { [KEY]: ['silver'] });

      account.switchTo('ada');

      expect(onSwitch).toHaveBeenCalledTimes(1);
      expect(document.loaded()).toBe(false);
      expect(document.value()).toEqual([]);
      account.flush();
      expect(document.loaded()).toBe(true);
      expect(document.value()).toEqual(['silver']);
      expect(account.storageOf('ada').stored(KEY)).toEqual(['silver']);
    });

    it("writes into the next player's storage only", () => {
      const document = create();
      account.flush();
      account.switchTo('ada');
      account.flush();

      add(document, 'gold');
      account.flush();

      expect(account.storageOf('ada').stored(KEY)).toEqual(['gold']);
      expect(account.storageOf('guest').stored(KEY)).toBeNull();
    });

    it("adds the guest's value to the account signed in to, once", () => {
      const adopt = jest.fn(union);
      const document = create({ stored: { [KEY]: ['gold'] }, adopt });
      account.flush();
      account.seed('ada', { [KEY]: ['silver'] });

      account.switchTo('ada', true);
      account.flush();

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(account.storageOf('ada').stored(KEY)).toEqual(['gold', 'silver']);
      expect(document.value()).toEqual(['gold', 'silver']);
    });

    it('adopts nothing from a guest who held nothing', () => {
      const adopt = jest.fn(union);
      create({ adopt });
      account.flush();

      account.switchTo('ada', true);
      account.flush();

      expect(adopt).not.toHaveBeenCalled();
      expect(account.storageOf('ada').stored(KEY)).toBeNull();
    });
  });

  describe('the copy this device kept before the cloud', () => {
    it('goes to the first player, once, and leaves the device', () => {
      const document = create({
        stored: { [KEY]: ['silver'] },
        onDevice: { [KEY]: ['gold'] },
      });

      device.flush();
      account.flush();
      device.flush();

      expect(document.value()).toEqual(['gold', 'silver']);
      expect(account.storageOf('guest').stored(KEY)).toEqual([
        'gold',
        'silver',
      ]);
      expect(device.stored(KEY)).toBeNull();

      account.switchTo('ada');
      device.flush();
      account.flush();
      expect(account.storageOf('ada').stored(KEY)).toBeNull();
    });

    it('goes to no player who takes over before the device answered', () => {
      create({ onDevice: { [KEY]: ['gold'] } });
      account.flush();

      account.switchTo('ada');
      device.flush();
      account.flush();

      expect(account.storageOf('guest').stored(KEY)).toBeNull();
      expect(account.storageOf('ada').stored(KEY)).toBeNull();
      expect(device.stored(KEY)).toEqual(['gold']);
    });

    it('stays on the device without the cloud', () => {
      const document = create({ onDevice: { [KEY]: ['gold'] }, cloud: false });
      expect(account.cloud).toBe(false);

      device.flush();
      account.flush();

      expect(document.value()).toEqual([]);
      expect(device.stored(KEY)).toEqual(['gold']);
    });
  });

  it('hands each value the storage told to onStored, which may write back', () => {
    const onStored = jest.fn(
      (value: Badges, apply: PlayerDocument<Badges>['apply']) => {
        if (!value.includes('welcome')) {
          apply(union(value, ['welcome']), (stored) =>
            union(stored, ['welcome'])
          );
        }
      }
    );
    const document = create({ stored: { [KEY]: ['gold'] }, onStored });

    account.flush();
    expect(onStored).toHaveBeenCalledWith(['gold'], expect.any(Function));
    expect(document.value()).toEqual(['gold', 'welcome']);
    account.flush();

    expect(account.storageOf('guest').stored(KEY)).toEqual(['gold', 'welcome']);
    expect(onStored).toHaveBeenCalledTimes(2);
  });

  it('stops following the player with its injection context', () => {
    const document = create();
    account.flush();

    TestBed.resetTestingModule();
    void account.storageOf('guest').update(KEY, () => ['gold']);
    account.flush();

    expect(document.value()).toEqual([]);
  });
});
