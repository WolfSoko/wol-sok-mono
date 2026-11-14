import { TestBed } from '@angular/core/testing';
import { BLOCKED_STORAGE } from '../../testing/storage';
import { SIGNED_IN_KEY, deviceFlag, ACCOUNT_SESSION } from './account';

describe('deviceFlag', () => {
  afterEach(() => localStorage.clear());

  it("remembers the sign-in in the device's storage", () => {
    const flag = deviceFlag(localStorage);

    flag.set();
    expect(deviceFlag(localStorage).isSet()).toBe(true);

    flag.clear();
    expect(localStorage.getItem(SIGNED_IN_KEY)).toBeNull();
    expect(flag.isSet()).toBe(false);
  });

  it("hears of another tab's sign-in or sign-out, and of nothing else", () => {
    const browserWindow = new EventTarget();
    let heard = 0;
    deviceFlag(localStorage, browserWindow).watch(() => heard++);

    browserWindow.dispatchEvent(
      new StorageEvent('storage', { key: SIGNED_IN_KEY })
    );
    browserWindow.dispatchEvent(
      new StorageEvent('storage', { key: 'anderes' })
    );
    browserWindow.dispatchEvent(new StorageEvent('storage', { key: null }));

    expect(heard).toBe(2);
  });

  it('knows of no sign-in where the storage is blocked', () => {
    const flag = deviceFlag(BLOCKED_STORAGE);

    flag.set();

    expect(flag.isSet()).toBe(false);
  });
});

describe('ACCOUNT_SESSION', () => {
  afterEach(() => localStorage.clear());

  it('starts on the device for an Elternteil never signed in', () => {
    const session = TestBed.inject(ACCOUNT_SESSION);

    expect(session.state()).toEqual({ kind: 'signed-out' });
    expect(session.selection.teams()).toEqual([]);
  });
});
