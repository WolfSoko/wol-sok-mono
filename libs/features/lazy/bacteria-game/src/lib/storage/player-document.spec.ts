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

  /** Lets the promises the storages resolved run on. */
  async function settle(): Promise<void> {
    for (let i = 0; i < 5; i++) {
      await Promise.resolve();
    }
  }

  /** Answers the device until it has nothing left, the cloud left waiting. */
  async function answerDevice(): Promise<void> {
    for (let round = 0; round < 3; round++) {
      device.flush();
      await settle();
    }
  }

  /** Answers the cloud and the device until neither has anything left. */
  async function answerAll(onDevice = device): Promise<void> {
    for (let round = 0; round < 5; round++) {
      account.flush();
      onDevice.flush();
      await settle();
    }
  }

  /** A second page on the same device and account: the next visit, or another tab. */
  function createOn(
    onDevice: LateGameStorage,
    options: Partial<PlayerDocumentOptions<Badges>> = {}
  ): PlayerDocument<Badges> {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: onDevice },
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
    it('leaves the device at once, kept as unsaved until the cloud stored it', async () => {
      create({ onDevice: { [KEY]: ['gold'] } });
      device.flush();
      await answerDevice();

      expect(device.stored(KEY)).toBeNull();
      expect(Object.values(device.stored(`${KEY}.unsaved`) ?? {})).toEqual([
        { player: 'guest', value: ['gold'] },
      ]);

      await answerAll();

      expect(account.storageOf('guest').stored(KEY)).toEqual(['gold']);
      expect(device.stored(`${KEY}.unsaved`)).toBeNull();
    });

    it('leaves the device at once where the journal is refused, so no second page adopts it', async () => {
      const adopt = jest.fn(union);
      create({ onDevice: { [KEY]: ['gold'] }, adopt });
      const refuseJournal = jest.spyOn(device, 'update');
      refuseJournal.mockImplementation(() => Promise.resolve(false));
      await answerDevice();

      expect(device.stored(KEY)).toBeNull();

      createOn(device, { adopt });
      await answerAll();

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(account.storageOf('guest').stored(KEY)).toEqual(['gold']);
    });

    it('goes to no second page that starts meanwhile', async () => {
      const adopt = jest.fn(union);
      create({ onDevice: { [KEY]: ['gold'] }, adopt });
      device.flush();
      await answerDevice();

      createOn(device, { adopt });
      await answerAll();

      expect(adopt).toHaveBeenCalledTimes(1);
      expect(account.storageOf('guest').stored(KEY)).toEqual(['gold']);
    });

    it('goes to the player on the next visit when the cloud never stored it', async () => {
      create({ onDevice: { [KEY]: ['gold'] } });
      device.flush();
      await answerDevice();

      // The page closes before the cloud answered; the next visit starts.
      const next = new LateGameStorage({
        [`${KEY}.unsaved`]: device.stored(`${KEY}.unsaved`),
      });
      account.seed('guest', {});
      createOn(next);
      await answerAll(next);

      expect(account.storageOf('guest').stored(KEY)).toEqual(['gold']);
      expect(next.stored(`${KEY}.unsaved`)).toBeNull();
    });

    it('goes to the first player, once, and leaves the device', async () => {
      const document = create({
        stored: { [KEY]: ['silver'] },
        onDevice: { [KEY]: ['gold'] },
      });

      device.flush();
      await answerAll();

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

  describe('changes the cloud has not stored yet', () => {
    const UNSAVED = `${KEY}.unsaved`;

    /** The unsaved changes on a device, as values by player. */
    function unsavedOn(onDevice = device): Record<string, unknown[]> {
      const changes = (onDevice.stored(UNSAVED) ?? {}) as Record<
        string,
        { player: string; value: unknown }
      >;
      const byPlayer: Record<string, unknown[]> = {};
      for (const { player, value } of Object.values(changes)) {
        (byPlayer[player] ??= []).push(value);
      }
      return byPlayer;
    }

    it('are kept on the device with what the page held', async () => {
      const document = create({ stored: { [KEY]: ['gold'] } });
      add(document, 'silver');
      await answerDevice();

      expect(unsavedOn()).toEqual({ guest: [['silver']] });
    });

    it('leave the device once the cloud stored the latest of them', async () => {
      const document = create();
      add(document, 'silver');
      device.flush();
      await settle();
      account.flush();
      await answerAll();

      expect(account.storageOf('guest').stored(KEY)).toEqual(['silver']);
      expect(device.stored(UNSAVED)).toBeNull();
    });

    it('stay while a later change still waits for the cloud', async () => {
      const document = create();
      add(document, 'silver');
      account.flush(); // the first change is stored ...
      add(document, 'gold'); // ... while the next one waits
      await answerDevice();

      expect(account.storageOf('guest').stored(KEY)).toEqual(['silver']);
      expect(unsavedOn()).toEqual({ guest: [['gold', 'silver']] });
    });

    it('go to the same player on the next visit, and leave the device then', async () => {
      const document = create({ stored: { [KEY]: ['gold'] } });
      add(document, 'silver');
      device.flush();
      await settle();
      const left = device.stored(UNSAVED);

      // The page closes before the cloud answered; the next visit starts.
      account.seed('guest', { [KEY]: ['gold'] });
      const next = new LateGameStorage({ [UNSAVED]: left });
      const visit = createOn(next);
      next.flush();
      await settle();

      expect(visit.value()).toEqual(['silver']);
      await answerAll(next);

      expect(visit.value()).toEqual(['gold', 'silver']);
      expect(account.storageOf('guest').stored(KEY)).toEqual([
        'gold',
        'silver',
      ]);
      expect(next.stored(UNSAVED)).toBeNull();
    });

    it('change nothing when they are replayed once more', async () => {
      const merge = jest.fn(union);
      account = new FakeGameAccount('guest');
      account.seed('guest', { [KEY]: ['gold', 'silver'] });
      const next = new LateGameStorage({
        [UNSAVED]: { 'closed:guest': { player: 'guest', value: ['silver'] } },
      });
      createOn(next, { merge });
      await answerAll(next);

      expect(account.storageOf('guest').stored(KEY)).toEqual([
        'gold',
        'silver',
      ]);
      expect(next.stored(UNSAVED)).toBeNull();
    });

    it("leave another player's changes alone", async () => {
      account = new FakeGameAccount('guest');
      const theirs = { 'closed:ada': { player: 'ada', value: ['gold'] } };
      const next = new LateGameStorage({ [UNSAVED]: theirs });
      const visit = createOn(next);
      await answerAll(next);

      expect(visit.value()).toEqual([]);
      expect(account.storageOf('guest').stored(KEY)).toBeNull();
      expect(next.stored(UNSAVED)).toEqual(theirs);
    });

    it('are applied when their player takes over again', async () => {
      account = new FakeGameAccount('guest');
      const next = new LateGameStorage({
        [UNSAVED]: { 'closed:ada': { player: 'ada', value: ['gold'] } },
      });
      createOn(next);
      await answerAll(next);

      account.switchTo('ada');
      await answerAll(next);

      expect(account.storageOf('ada').stored(KEY)).toEqual(['gold']);
      expect(next.stored(UNSAVED)).toBeNull();
    });

    /** A document on a cloud whose updates answer as `answers` say, in turn. */
    function createAnswering(answers: boolean[]): PlayerDocument<Badges> {
      account = new FakeGameAccount('guest');
      const cloud = account.storage;
      const answering: GameStorage = {
        watch: (key) => cloud.watch(key),
        write: (key, value) => cloud.write(key, value),
        update: (key, change) =>
          cloud.update(key, change).then(() => answers.shift() ?? true),
      };
      TestBed.resetTestingModule();
      TestBed.configureTestingModule({
        providers: [
          { provide: GameAccount, useValue: account },
          { provide: GameStorage, useValue: answering },
          { provide: DeviceStorage, useValue: device },
        ],
      });
      return TestBed.runInInjectionContext(() => playerDocument(BADGES));
    }

    it('stay for the next start when the storage dropped the change', async () => {
      const document = createAnswering([false]);
      add(document, 'silver');
      await answerAll();

      expect(unsavedOn()['guest']).toContainEqual(['silver']);
    });

    it('stay when a change was dropped, though a later one was stored', async () => {
      const document = createAnswering([false, true]);
      add(document, 'silver');
      await answerAll();
      add(document, 'gold');
      await answerAll();

      expect(unsavedOn()).toEqual({ guest: [['silver']] });
    });

    it('keep the page entry where the device refused to keep a dropped change apart', async () => {
      const document = createAnswering([false, true]);
      add(document, 'silver');
      await answerDevice();
      // The device takes the page entry, but not the dropped change's own.
      const update = device.update.bind(device);
      const refuseDropped = jest.spyOn(device, 'update');
      refuseDropped.mockImplementationOnce(() => Promise.resolve(false));
      await answerAll();
      refuseDropped.mockImplementation(update);
      add(document, 'gold');
      await answerAll();

      expect(unsavedOn()).toEqual({ guest: [['gold', 'silver']] });
    });

    it('are not kept without the cloud', async () => {
      const document = create({ cloud: false });
      add(document, 'silver');
      await answerAll();

      expect(device.stored(UNSAVED)).toBeNull();
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
