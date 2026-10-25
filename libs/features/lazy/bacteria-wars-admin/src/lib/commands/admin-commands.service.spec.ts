import { TestBed } from '@angular/core/testing';
import {
  type FirebaseConnection,
  GameCloud,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import { AdminAccessService } from '../access/admin-access.service';
import {
  AdminCommandsService,
  RESULT_TIMEOUT_MS,
} from './admin-commands.service';

const NOW = Date.UTC(2026, 9, 25, 12);

/** Firestore that stores one command and lets the test answer it. */
function setUp({ uid = 'owner' as string | null, lately = true } = {}) {
  let listener: ((snapshot: { get: (key: string) => unknown }) => void) | null =
    null;
  const stop = jest.fn();
  const dbSdk = {
    collection: jest.fn((_db: unknown, name: string) => name),
    addDoc: jest.fn(async () => ({ id: 'c1' })),
    serverTimestamp: () => 'SERVER_TIME',
    Timestamp: { fromMillis: (ms: number) => ({ ms }) },
    onSnapshot: jest.fn((_ref, next: typeof listener) => {
      listener = next;
      return stop;
    }),
  };
  const connection = { db: {}, dbSdk } as unknown as FirebaseConnection;
  TestBed.configureTestingModule({
    providers: [
      { provide: GameCloud, useValue: { firebase: () => connection } },
      {
        provide: AdminAccessService,
        useValue: { uid: () => uid, signedInLately: () => lately },
      },
    ],
  });
  const answer = (result: unknown) =>
    listener?.({ get: (key) => (key === 'result' ? result : undefined) });
  return { dbSdk, stop, answer };
}

const flush = () => new Promise((resolve) => setTimeout(resolve));

describe('AdminCommandsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('writes the command and answers with the server result', async () => {
    const { dbSdk, stop, answer } = setUp();
    const sent = TestBed.inject(AdminCommandsService).send(
      {
        type: 'player.ban',
        target: { uid: 'ada' },
        reason: 'Cheating',
        args: { until: null, reason: 'cheating' },
      },
      NOW
    );
    await flush();
    expect(dbSdk.addDoc).toHaveBeenCalledWith('adminCommands', {
      uid: 'owner',
      type: 'player.ban',
      target: { uid: 'ada' },
      reason: 'Cheating',
      args: { until: null, reason: 'cheating' },
      createdAt: 'SERVER_TIME',
      expireAt: { ms: NOW + 24 * 3_600_000 },
    });

    answer(undefined); // the write itself, before the function ran
    answer({ ok: false, error: 'ended' });

    expect(await sent).toEqual({ ok: false, error: 'ended' });
    expect(stop).toHaveBeenCalled();
  });

  it('sends a gallery curation as a replay command, reading its reason', async () => {
    const { dbSdk, answer } = setUp({ lately: false });
    const sent = TestBed.inject(AdminCommandsService).sendReplay(
      'unfeature',
      'p1',
      NOW
    );
    await flush();
    expect(dbSdk.addDoc).toHaveBeenCalledWith('replayCommands', {
      uid: 'owner',
      type: 'unfeature',
      replayId: 'p1',
      createdAt: 'SERVER_TIME',
      expireAt: { ms: NOW + 24 * 3_600_000 },
    });

    answer({ ok: false, reason: 'not-public' });
    expect(await sent).toEqual({ ok: false, error: 'not-public' });
  });

  it('gives up when no result comes', async () => {
    jest.useFakeTimers();
    try {
      const { stop } = setUp();
      const sent = TestBed.inject(AdminCommandsService).send(
        { type: 'stats.refresh', target: null, reason: '', args: {} },
        NOW
      );
      await jest.advanceTimersByTimeAsync(RESULT_TIMEOUT_MS);

      expect(await sent).toEqual({ ok: false, error: 'timeout' });
      expect(stop).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves out an empty reason, which only stats.* may have', async () => {
    const { dbSdk, answer } = setUp();
    const sent = TestBed.inject(AdminCommandsService).send(
      { type: 'stats.refresh', target: null, reason: '', args: {} },
      NOW
    );
    await flush();
    expect(dbSdk.addDoc).toHaveBeenCalledWith(
      'adminCommands',
      expect.not.objectContaining({ reason: expect.anything() })
    );
    answer({ ok: true });
    expect(await sent).toEqual({ ok: true });
  });

  it('asks for a fresh sign-in before a destructive command', async () => {
    const { dbSdk } = setUp({ lately: false });

    expect(
      await TestBed.inject(AdminCommandsService).send({
        type: 'profile.reset',
        target: { uid: 'ada' },
        reason: 'Rude name',
        args: {},
      })
    ).toEqual({ ok: false, error: 'sign-in-again' });
    expect(dbSdk.addDoc).not.toHaveBeenCalled();
  });

  it('sends nothing for anybody but the owner', async () => {
    const { dbSdk } = setUp({ uid: null });

    expect(
      await TestBed.inject(AdminCommandsService).send({
        type: 'stats.refresh',
        target: null,
        reason: '',
        args: {},
      })
    ).toEqual({ ok: false, error: 'not-admin' });
    expect(dbSdk.addDoc).not.toHaveBeenCalled();
  });
});
