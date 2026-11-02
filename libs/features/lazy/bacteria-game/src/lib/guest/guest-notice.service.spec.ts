import { TestBed } from '@angular/core/testing';
import { FakeGameAccount } from '../../testing/fake-game-account';
import { LateGameStorage } from '../../testing/late-game-storage';
import { GameAccount } from '../storage/game-account';
import { DeviceStorage, GameStorage } from '../storage/game-storage';
import { GuestNotice } from './guest-notice.service';
import { GUEST_NOTICE_KEY, GuestVisits, localDay } from './guest-visits';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('GuestNotice', () => {
  let account: FakeGameAccount;
  let device: LateGameStorage;

  /** Noon, so the day before is a calendar day before, clock changes or not. */
  const NOW = new Date(2026, 9, 26, 12).getTime();

  beforeEach(() => jest.spyOn(Date, 'now').mockReturnValue(NOW));
  afterEach(() => jest.restoreAllMocks());

  function start(stored?: Partial<GuestVisits>): GuestNotice {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
    account.profile.set({ guest: true, name: null });
    device = new LateGameStorage(
      stored === undefined ? {} : { [GUEST_NOTICE_KEY]: stored }
    );
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: device },
      ],
    });
    const notice = TestBed.inject(GuestNotice);
    device.flush();
    return notice;
  }

  /** What the device holds once its writes landed. */
  function storedVisits(): unknown {
    let value: unknown;
    device.watch(GUEST_NOTICE_KEY).subscribe((v) => (value = v));
    device.flush();
    return value;
  }

  const yesterday = () => {
    const at = new Date(2026, 9, 25, 12).getTime();
    return { lastDay: localDay(at), lastAt: at };
  };

  it('counts the day the game was opened', () => {
    start();

    expect(storedVisits()).toMatchObject({
      days: 1,
      lastDay: '2026-10-26',
    });
  });

  it('shows nothing on the first two days', () => {
    const notice = start({ days: 1, ...yesterday() });

    expect(notice.guest()).toBe(true);
    expect(notice.visible()).toBe(false);
  });

  it('shows the notice to a guest from the third day', () => {
    const notice = start({ days: 2, ...yesterday() });

    expect(notice.visible()).toBe(true);
    expect(notice.cameBack()).toBe(false);
  });

  it('shows nothing to a signed-in player', () => {
    const notice = start({ days: 7, ...yesterday() });
    account.profile.set({ guest: false, name: 'Ada' });

    expect(notice.visible()).toBe(false);
    expect(notice.successHintDue()).toBe(false);
  });

  it('puts the notice away on "Later", and keeps that on the device', () => {
    const notice = start({ days: 4, ...yesterday() });

    notice.dismiss();

    expect(notice.visible()).toBe(false);
    expect(storedVisits()).toMatchObject({ dismissedAt: expect.any(Number) });
  });

  it('welcomes a guest back after a long pause, put away or not', () => {
    const notice = start({
      days: 1,
      lastDay: '2026-01-01',
      lastAt: NOW - 40 * DAY_MS,
      dismissedAt: NOW - 40 * DAY_MS,
    });

    expect(notice.cameBack()).toBe(true);
    expect(notice.visible()).toBe(true);
  });

  it('offers the sign-in after a success once per device', () => {
    const notice = start();
    expect(notice.successHintDue()).toBe(true);

    notice.markSuccessHintShown();

    expect(notice.successHintDue()).toBe(false);
    expect(storedVisits()).toMatchObject({ successHintShown: true });
  });

  it('waits for the device before it says anything', () => {
    TestBed.resetTestingModule();
    account = new FakeGameAccount();
    account.profile.set({ guest: true, name: null });
    device = new LateGameStorage({
      [GUEST_NOTICE_KEY]: { days: 5, ...yesterday() },
    });
    TestBed.configureTestingModule({
      providers: [
        { provide: GameAccount, useValue: account },
        { provide: GameStorage, useValue: account.storage },
        { provide: DeviceStorage, useValue: device },
      ],
    });
    const notice = TestBed.inject(GuestNotice);

    expect(notice.visible()).toBe(false);
    expect(notice.successHintDue()).toBe(false);
  });
});
