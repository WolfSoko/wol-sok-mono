import {
  LEGACY_SELECTION_KEY,
  moveLegacyDeviceSelection,
} from './legacy-device-selection';
import { SELECTION_KEY, LocalSelection } from './local-selection';

/** The device's storage in memory; `voll` refuses every write. */
class Storage {
  public voll = false;
  public readonly items = new Map<string, string>();

  public getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    if (this.voll) {
      throw new DOMException('full', 'QuotaExceededError');
    }
    this.items.set(key, value);
  }

  public removeItem(key: string): void {
    this.items.delete(key);
  }
}

const LEGACY = {
  version: 2,
  teams: { 313036: 10, 201500: 20 },
  kinder: { 4711: { seit: 30, spitzname: 'Mimi' } },
  vereinsfarben: { 4343: '#1d4ed8' },
};

describe('moveLegacyDeviceSelection', () => {
  it('moves the legacy selection to the new key as version 3, the same choices', () => {
    const storage = new Storage();
    storage.setItem(LEGACY_SELECTION_KEY, JSON.stringify(LEGACY));

    moveLegacyDeviceSelection(storage);

    expect(storage.getItem(LEGACY_SELECTION_KEY)).toBeNull();
    expect(JSON.parse(storage.getItem(SELECTION_KEY) ?? '')).toEqual({
      version: 3,
      teams: { 313036: 10, 201500: 20 },
      children: { 4711: { since: 30, nickname: 'Mimi' } },
      clubColors: { 4343: '#1d4ed8' },
    });
    const selection = new LocalSelection(storage);
    expect(selection.teams()).toEqual([313036, 201500]);
    expect(selection.children()).toEqual([
      { personId: 4711, nickname: 'Mimi' },
    ]);
    expect(selection.clubColors()).toEqual([
      { clubId: 4343, primary: '#1d4ed8' },
    ]);
  });

  it('leaves the legacy key where the storage is full, for the next start', () => {
    const storage = new Storage();
    storage.setItem(LEGACY_SELECTION_KEY, JSON.stringify(LEGACY));
    storage.voll = true;

    moveLegacyDeviceSelection(storage);

    expect(storage.getItem(LEGACY_SELECTION_KEY)).not.toBeNull();
    expect(storage.getItem(SELECTION_KEY)).toBeNull();
  });

  it('drops the legacy key where the new one holds a selection already', () => {
    const storage = new Storage();
    const updated = JSON.stringify({ version: 3, teams: { 201765: 1 } });
    storage.setItem(SELECTION_KEY, updated);
    storage.setItem(LEGACY_SELECTION_KEY, JSON.stringify(LEGACY));

    moveLegacyDeviceSelection(storage);

    expect(storage.getItem(LEGACY_SELECTION_KEY)).toBeNull();
    expect(storage.getItem(SELECTION_KEY)).toBe(updated);
  });

  it.each([
    ['no JSON', '{"teams": [31'],
    ['no legacy version', JSON.stringify({ version: 7, teams: {} })],
  ])('drops a legacy key holding %s', (_, text) => {
    const storage = new Storage();
    storage.setItem(LEGACY_SELECTION_KEY, text);

    moveLegacyDeviceSelection(storage);

    expect(storage.items.size).toBe(0);
  });

  it('changes nothing without a legacy key', () => {
    const storage = new Storage();

    moveLegacyDeviceSelection(storage);

    expect(storage.items.size).toBe(0);
  });
});
