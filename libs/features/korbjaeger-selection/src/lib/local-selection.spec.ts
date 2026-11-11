import { contentOf } from './selection-changes';
import { readSelectionDocument } from './selection-document';
import type { SelectionContent } from './selection-lists';
import { SELECTION_KEY, LocalSelection } from './local-selection';
import { selectionContract } from '../testing/selection-contract';

/** What `device` stores, as the app reads it. */
function stored(device: Pick<Storage, 'getItem'>): SelectionContent {
  const { teams, children, clubColors } = contentOf(
    readSelectionDocument(JSON.parse(device.getItem(SELECTION_KEY) ?? 'null'))
  );
  return { teams, children, clubColors };
}

/**
 * The device's storage, as the adapter uses it, in memory. Like a browser
 * it tells the tabs on `events` of every write; this one tells the
 * writing tab too, which reads what it wrote again.
 */
class SpecStorage {
  public readonly events = new EventTarget();
  public writeCount = 0;
  private readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.writeCount++;
    this.setzeLeise(key, value);
    this.events.dispatchEvent(new StorageEvent('storage', { key }));
  }

  /** Stores `value` without telling any tab. */
  public setzeLeise(key: string, value: string): void {
    this.items.set(key, value);
  }

  public removeItem(key: string): void {
    this.items.delete(key);
    this.events.dispatchEvent(new StorageEvent('storage', { key }));
  }
}

selectionContract('local', () => {
  const device = new SpecStorage();
  return {
    open: async () => new LocalSelection(device, device.events),
    writeRaw: async (raw) => device.setItem(SELECTION_KEY, JSON.stringify(raw)),
    readRaw: async () => JSON.parse(device.getItem(SELECTION_KEY) ?? 'null'),
    untilSettled: async () => undefined,
  };
});

describe('LocalSelection', () => {
  describe('reread', () => {
    it('reads what another tab stored, before its storage event came', () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device, device.events);
      device.setzeLeise(
        SELECTION_KEY,
        JSON.stringify({ version: 3, teams: { 201500: 1 } })
      );

      expect(selection.reread()).toEqual({
        teams: [201500],
        children: [],
        clubColors: [],
      });
      expect(selection.teams()).toEqual([201500]);
    });

    it('keeps the changes no write could store yet', async () => {
      const selection = new LocalSelection(undefined);
      await selection.follow(313036);

      expect(selection.reread().teams).toEqual([313036]);
    });
  });

  describe('handOver', () => {
    const MIMI = { kind: 'named', personId: 4711 } as const;

    it('takes off what an account took over, leaving what joined meanwhile', async () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device);
      await selection.follow(313036);
      await selection.mark(MIMI, 'Mimi');
      const takenOver = selection.reread();
      await new LocalSelection(device).follow(201500);

      expect(selection.handOver(takenOver)).toEqual({
        teams: [201500],
        children: [],
        clubColors: [],
      });
      expect(stored(device)).toEqual({
        teams: [201500],
        children: [],
        clubColors: [],
      });
    });

    it('keeps a Kind whose Spitzname changed since it was taken over', async () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device);
      await selection.mark(MIMI, 'Mimi');
      const takenOver = selection.reread();
      await selection.setNickname(MIMI.personId, 'Mi');

      expect(selection.handOver(takenOver).children).toEqual([
        { personId: 4711, nickname: 'Mi' },
      ]);
    });

    it('takes all off in the one write, leaving an empty document', async () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device);
      await selection.follow(313036);
      const writes = device.writeCount;

      expect(selection.handOver(selection.reread())).toEqual({
        teams: [],
        children: [],
        clubColors: [],
      });
      expect(device.writeCount).toBe(writes + 1);
      expect(JSON.parse(device.getItem(SELECTION_KEY) ?? '')).toEqual({
        version: 3,
        teams: {},
      });
    });
  });

  it('stores a versioned document, with Meine Teams and the Kinder', async () => {
    const device = new SpecStorage();

    await new LocalSelection(device).follow(313036);

    expect(JSON.parse(device.getItem(SELECTION_KEY) ?? '')).toEqual({
      version: 3,
      teams: { 313036: expect.any(Number) },
    });
  });

  it('stores a change before the call returns, so leaving the page right after keeps it', () => {
    const device = new SpecStorage();
    const selection = new LocalSelection(device);
    void selection.follow(313036);
    void selection.mark({ kind: 'named', personId: 4711 });

    void selection.unfollow(313036);

    expect(stored(device)).toEqual({
      teams: [],
      children: [{ personId: 4711 }],
      clubColors: [],
    });
  });

  it('writes nothing to mark a Kind marked already', async () => {
    const device = new SpecStorage();
    const selection = new LocalSelection(device);
    await selection.mark({ kind: 'named', personId: 4711 }, 'Mimi');
    const before = device.writeCount;

    await selection.mark({ kind: 'named', personId: 4711 });
    await selection.setNickname(4711, ' Mimi ');
    await selection.unmark(4799);

    expect(device.writeCount).toBe(before);
  });

  it('keeps its Kinder as they are where another tab stored the same', async () => {
    const device = new SpecStorage();
    const selection = new LocalSelection(device, device.events);
    await selection.mark({ kind: 'named', personId: 4711 }, 'Mimi');
    const before = selection.children();

    await selection.follow(313036);

    expect(selection.children()).toBe(before);
  });

  it('starts empty from storage that holds no JSON', () => {
    const device = new SpecStorage();
    device.setItem(SELECTION_KEY, '{"teams": [31');

    expect(new LocalSelection(device).teams()).toEqual([]);
  });

  it.each([
    ['an earlier version', { version: 2, teams: { 313036: 1 } }],
    ['no version', { teams: { 313036: 1 } }],
    ['Teams as a list', { version: 3, teams: [313036] }],
    ['no map of Teams', { version: 3, teams: 313036 }],
    ['a Team that is no DBB id', { version: 3, teams: { 313036: 1, x: 2 } }],
    ['a negative Team id', { version: 3, teams: { '-1': 1 } }],
    ['no object', [313036]],
    ['null', null],
  ])('ignores a stored document with %s', (_case, raw) => {
    const device = new SpecStorage();
    device.setItem(SELECTION_KEY, JSON.stringify(raw));

    expect(new LocalSelection(device).teams()).toEqual([]);
  });

  describe('a full storage', () => {
    /** Storage that is full until `makeRoom` freed it. */
    function fullStorage(): {
      storage: SpecStorage;
      makeRoom: ReturnType<typeof vi.fn<() => void>>;
    } {
      const device = new SpecStorage();
      let full = true;
      const schreiben = device.setItem.bind(device);
      vi.spyOn(device, 'setItem').mockImplementation((key, value) => {
        if (full) {
          throw new DOMException('full', 'QuotaExceededError');
        }
        schreiben(key, value);
      });
      const makeRoom = vi.fn(() => {
        full = false;
      });
      return { storage: device, makeRoom };
    }

    it('has the cached data give way to Meine Teams, and stores them then', async () => {
      const { storage, makeRoom } = fullStorage();

      await new LocalSelection(storage, undefined, makeRoom).follow(313036);

      expect(makeRoom).toHaveBeenCalledTimes(1);
      expect(stored(storage)).toEqual({
        teams: [313036],
        children: [],
        clubColors: [],
      });
    });

    it('asks for room only on a full storage, and tries once more only', async () => {
      const device = new SpecStorage();
      vi.spyOn(device, 'setItem').mockImplementation(() => {
        throw new DOMException('denied', 'SecurityError');
      });
      const makeRoom = vi.fn();
      const selection = new LocalSelection(device, undefined, makeRoom);

      await selection.follow(313036);

      expect(makeRoom).not.toHaveBeenCalled();
      // the change still holds for this visit
      expect(selection.teams()).toEqual([313036]);
    });
  });

  it('writes nothing to unfollow a Team it does not follow', async () => {
    const device = new SpecStorage();
    const selection = new LocalSelection(device);
    await selection.follow(313036);
    const before = device.writeCount;

    await selection.unfollow(201500);

    expect(device.writeCount).toBe(before);
  });

  describe('two tabs on one storage', () => {
    it('shows no Team once the storage was cleared', async () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device, device.events);
      await selection.follow(313036);

      device.removeItem(SELECTION_KEY);

      expect(selection.teams()).toEqual([]);
    });

    it('keeps its Teams as they are where another tab stored the same', async () => {
      const device = new SpecStorage();
      const tabA = new LocalSelection(device, device.events);
      await tabA.follow(313036);
      const before = tabA.teams();

      device.setItem(
        SELECTION_KEY,
        JSON.stringify({ version: 3, teams: { 313036: 1 }, mehr: 1 })
      );

      expect(tabA.teams()).toBe(before);
    });

    it('passes over changes to other keys', async () => {
      const device = new SpecStorage();
      const selection = new LocalSelection(device, device.events);
      await selection.follow(313036);
      device.setzeLeise(
        SELECTION_KEY,
        JSON.stringify({ version: 3, teams: { 201500: 1 } })
      );

      device.events.dispatchEvent(
        new StorageEvent('storage', { key: 'etwas-anderes' })
      );
      expect(selection.teams()).toEqual([313036]);

      device.events.dispatchEvent(
        new StorageEvent('storage', { key: SELECTION_KEY })
      );
      expect(selection.teams()).toEqual([201500]);
    });

    it('listens no longer once ended', async () => {
      const device = new SpecStorage();
      const tabA = new LocalSelection(device, device.events);
      const tabB = new LocalSelection(device);

      tabA.stop();
      await tabB.follow(313036);

      expect(tabA.teams()).toEqual([]);
    });
  });

  it('follows no Team where the storage cannot be read', () => {
    const selection = new LocalSelection({
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: () => undefined,
    });

    expect(selection.teams()).toEqual([]);
  });

  it('still follows where the storage takes nothing, for this visit', async () => {
    const selection = new LocalSelection({
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });

    await selection.follow(313036);
    await selection.follow(201500);

    expect(selection.teams()).toEqual([313036, 201500]);
  });

  describe('a change that could not be stored', () => {
    /** Storage that takes no write while `full`, as a full one. */
    function fullAtTimes(): {
      storage: SpecStorage;
      full: { on: boolean };
    } {
      const device = new SpecStorage();
      const full = { on: false };
      const schreiben = device.setItem.bind(device);
      vi.spyOn(device, 'setItem').mockImplementation((key, value) => {
        if (full.on) {
          throw new DOMException('full', 'QuotaExceededError');
        }
        schreiben(key, value);
      });
      return { storage: device, full };
    }

    const LUMI = { kind: 'named', personId: 4711 } as const;

    it('is kept for the next change, and stored with it once there is room', async () => {
      const { storage, full } = fullAtTimes();
      const selection = new LocalSelection(storage, storage.events);
      await selection.follow(313036);
      full.on = true;

      await selection.mark(LUMI, 'Lu');
      full.on = false;
      await selection.follow(201500);

      expect(selection.children()).toEqual([
        { personId: 4711, nickname: 'Lu' },
      ]);
      expect(stored(storage)).toEqual({
        teams: [313036, 201500],
        children: [{ personId: 4711, nickname: 'Lu' }],
        clubColors: [],
      });
    });

    it('restores a Team at its place while nothing can be stored', async () => {
      const { storage, full } = fullAtTimes();
      const selection = new LocalSelection(storage, storage.events);
      await selection.follow(313036);
      await selection.follow(201765);
      await selection.follow(201500);
      full.on = true;

      const place = await selection.unfollow(201765);
      await selection.follow(201765, place);

      expect(selection.teams()).toEqual([313036, 201765, 201500]);
      full.on = false;
      await selection.mark(LUMI);
      expect(stored(storage).teams).toEqual([313036, 201765, 201500]);
    });

    it('is dropped once another tab stored a newer version, which shows nothing', async () => {
      const { storage, full } = fullAtTimes();
      const selection = new LocalSelection(storage, storage.events);
      full.on = true;
      await selection.mark(LUMI);
      full.on = false;

      storage.setItem(
        SELECTION_KEY,
        JSON.stringify({ version: 99, teams: [201500] })
      );

      expect(selection.children()).toEqual([]);
      expect(selection.teams()).toEqual([]);
    });

    it("keeps what another tab stored meanwhile, with this tab's change", async () => {
      const { storage, full } = fullAtTimes();
      const tabA = new LocalSelection(storage, storage.events);
      const tabB = new LocalSelection(storage);
      full.on = true;
      await tabA.mark(LUMI);
      full.on = false;

      await tabB.follow(201500);

      // tab A still shows its own change beside tab B's
      expect(tabA.teams()).toEqual([201500]);
      expect(tabA.children()).toEqual([{ personId: 4711 }]);

      await tabA.follow(313036);
      expect(stored(storage)).toEqual({
        teams: [201500, 313036],
        children: [{ personId: 4711 }],
        clubColors: [],
      });
    });
  });

  it('follows for this visit where the device has no storage', async () => {
    const selection = new LocalSelection(undefined);

    await selection.follow(313036);
    await selection.follow(201500);

    expect(selection.teams()).toEqual([313036, 201500]);
  });
});

describe('a selection stored before #3010', () => {
  // byte for byte as the adapter wrote it before its identifiers became
  // English: version 3's fields stay as stored
  const STORED =
    '{"version":3,"teams":{"313036":1000,"201500":2000},"children":{"4711":{"since":1500,"nickname":"Mimi"},"4712":{"since":1600}},"clubColors":{"4242":"#c8102e,#1d4ed8"}}';

  it('reads every list as it was stored', () => {
    const device = new SpecStorage();
    device.setItem(SELECTION_KEY, STORED);
    const selection = new LocalSelection(device);

    expect(selection.teams()).toEqual([313036, 201500]);
    expect(selection.children()).toEqual([
      { personId: 4711, nickname: 'Mimi' },
      { personId: 4712 },
    ]);
    expect(selection.clubColors()).toEqual([
      { clubId: 4242, primary: '#c8102e', secondary: '#1d4ed8' },
    ]);
  });

  it('keeps the stored spellings when it writes a change', async () => {
    const device = new SpecStorage();
    device.setItem(SELECTION_KEY, STORED);

    await new LocalSelection(device).unfollow(201500);

    expect(JSON.parse(device.getItem(SELECTION_KEY) ?? 'null')).toEqual({
      version: 3,
      teams: { 313036: 1000 },
      children: {
        4711: { since: 1500, nickname: 'Mimi' },
        4712: { since: 1600 },
      },
      clubColors: { 4242: '#c8102e,#1d4ed8' },
    });
  });
});
