import { TestBed } from '@angular/core/testing';
import { GameCloud } from '@wolsok/feat-lazy-bac-game/admin-kit';
import {
  FakeFirebase,
  FakeTimestamp,
  SERVER_TIMESTAMP,
  settleSnapshots,
} from '@wolsok/feat-lazy-bac-game/testing';
import { AdminAccessService } from '../access/admin-access.service';
import {
  AdminCommandsService,
  RESULT_TIMEOUT_MS,
} from './admin-commands.service';

const NOW = Date.UTC(2026, 9, 25, 12);
const EXPIRE_AT = FakeTimestamp.fromMillis(NOW + 24 * 3_600_000);

/** Firestore that stores the commands, which the test answers. */
function setUp({ uid = 'owner' as string | null, lately = true } = {}) {
  const fake = new FakeFirebase();
  TestBed.configureTestingModule({
    providers: [
      { provide: GameCloud, useValue: { firebase: () => fake.connection() } },
      {
        provide: AdminAccessService,
        useValue: { uid: () => uid, signedInLately: () => lately },
      },
    ],
  });
  /** The function writes its result onto the command, as the first one. */
  const answer = (result: unknown) => {
    const [command] = fake.writes;
    fake.put(command.path, { ...fake.docs.get(command.path), result });
  };
  return { fake, answer };
}

describe('AdminCommandsService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('writes the command and answers with the server result', async () => {
    const { fake, answer } = setUp();
    const sent = TestBed.inject(AdminCommandsService).send(
      {
        type: 'player.ban',
        target: { uid: 'ada' },
        reason: 'Cheating',
        args: { until: null, reason: 'cheating' },
      },
      NOW
    );
    await settleSnapshots();
    expect(fake.writes).toEqual([
      {
        kind: 'set',
        path: 'adminCommands/auto1',
        data: {
          uid: 'owner',
          type: 'player.ban',
          target: { uid: 'ada' },
          reason: 'Cheating',
          args: { until: null, reason: 'cheating' },
          createdAt: SERVER_TIMESTAMP,
          expireAt: EXPIRE_AT,
        },
      },
    ]);
    // The write itself, before the function ran, told the listener already.
    expect(fake.openListeners()).toEqual(['adminCommands/auto1']);

    answer({ ok: false, error: 'ended' });

    expect(await sent).toEqual({ ok: false, error: 'ended' });
    expect(fake.openListeners()).toEqual([]);
  });

  it('asks for a fresh sign-in before curation that cannot be taken back', async () => {
    const { fake } = setUp({ lately: false });
    const service = TestBed.inject(AdminCommandsService);
    expect(await service.sendReplay('anonymise', 'p1', NOW)).toEqual({
      ok: false,
      error: 'sign-in-again',
    });
    expect(fake.writes).toEqual([]);
  });

  it('sends a gallery curation as a replay command, reading its error', async () => {
    const { fake, answer } = setUp();
    const sent = TestBed.inject(AdminCommandsService).sendReplay(
      'unfeature',
      'p1',
      NOW
    );
    await settleSnapshots();
    expect(fake.writes).toEqual([
      {
        kind: 'set',
        path: 'replayCommands/auto1',
        data: {
          uid: 'owner',
          type: 'unfeature',
          replayId: 'p1',
          createdAt: SERVER_TIMESTAMP,
          expireAt: EXPIRE_AT,
        },
      },
    ]);

    answer({ ok: false, error: 'not-public' });
    expect(await sent).toEqual({ ok: false, error: 'not-public' });
  });

  it('gives up when no result comes', async () => {
    jest.useFakeTimers();
    try {
      const { fake } = setUp();
      const sent = TestBed.inject(AdminCommandsService).send(
        { type: 'stats.refresh', target: null, reason: '', args: {} },
        NOW
      );
      await jest.advanceTimersByTimeAsync(RESULT_TIMEOUT_MS);

      expect(await sent).toEqual({ ok: false, error: 'timeout' });
      expect(fake.openListeners()).toEqual([]);
    } finally {
      jest.useRealTimers();
    }
  });

  it('leaves out an empty reason, which only stats.* may have', async () => {
    const { fake, answer } = setUp();
    const sent = TestBed.inject(AdminCommandsService).send(
      { type: 'stats.refresh', target: null, reason: '', args: {} },
      NOW
    );
    await settleSnapshots();
    expect(fake.writes[0].data).not.toHaveProperty('reason');
    answer({ ok: true });
    expect(await sent).toEqual({ ok: true });
  });

  it('asks for a fresh sign-in before a destructive command', async () => {
    const { fake } = setUp({ lately: false });

    expect(
      await TestBed.inject(AdminCommandsService).send({
        type: 'profile.reset',
        target: { uid: 'ada' },
        reason: 'Rude name',
        args: {},
      })
    ).toEqual({ ok: false, error: 'sign-in-again' });
    expect(fake.writes).toEqual([]);
  });

  it('sends nothing for anybody but the owner', async () => {
    const { fake } = setUp({ uid: null });

    expect(
      await TestBed.inject(AdminCommandsService).send({
        type: 'stats.refresh',
        target: null,
        reason: '',
        args: {},
      })
    ).toEqual({ ok: false, error: 'not-admin' });
    expect(fake.writes).toEqual([]);
  });
});
