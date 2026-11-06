import type { CommandResult } from '@wolsok/feat-shared-bacteria-engine';
import { logger } from 'firebase-functions/logger';
import { useEmulatorDb } from '../testing/emulator';
import { runCommandDocument } from './run-command-document';

/**
 * What every command document's runner does, against the Firestore
 * emulator (`test-emulator`): the writer check, the catch and the
 * write-back of `result`. What the commands do is the admin's and the
 * replays' suites.
 */
const db = useEmulatorDb();

const PATH = 'replayCommands/c1';
const COMMAND = { uid: 'ada', type: 'remove', replayId: 'r1' };

afterEach(() => jest.restoreAllMocks());

beforeEach(async () => {
  await db.doc(PATH).set(COMMAND);
});

const stored = async () => (await db.doc(PATH).get()).get('result');

function runner(answer: () => Promise<CommandResult | null>) {
  return jest.fn((_uid: string) => answer());
}

describe('runCommandDocument', () => {
  it('runs the command for its writer and writes the result back', async () => {
    const run = runner(async () => ({ ok: false, error: 'not-found' }));
    expect(await runCommandDocument(db, PATH, COMMAND, 'ada', run)).toEqual({
      ok: false,
      error: 'not-found',
    });
    expect(run).toHaveBeenCalledWith('ada');
    expect(await stored()).toMatchObject({ ok: false, error: 'not-found' });
    expect((await stored())['at']).toBeDefined();
  });

  it.each<[string, Record<string, unknown>, string | undefined]>([
    ['another writer', COMMAND, 'eve'],
    ['no signed-in writer', COMMAND, undefined],
    ['a command without uid', { type: 'remove', replayId: 'r1' }, 'ada'],
    ['a uid that is no string', { ...COMMAND, uid: 7 }, 'ada'],
  ])('refuses %s without running it', async (_, data, authId) => {
    const run = runner(async () => ({ ok: true }));
    expect(await runCommandDocument(db, PATH, data, authId, run)).toEqual({
      ok: false,
      error: 'not-writer',
    });
    expect(run).not.toHaveBeenCalled();
    expect(await stored()).toMatchObject({ ok: false, error: 'not-writer' });
  });

  it('answers internal for a command that throws, and logs it', async () => {
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const run = runner(async () => {
      throw new Error('boom');
    });
    expect(await runCommandDocument(db, PATH, COMMAND, 'ada', run)).toEqual({
      ok: false,
      error: 'internal',
    });
    expect(log).toHaveBeenCalledWith(
      'Command failed',
      expect.objectContaining({ path: PATH })
    );
    expect(await stored()).toMatchObject({ ok: false, error: 'internal' });
  });

  it('writes nothing where another delivery runs the command', async () => {
    const run = runner(async () => null);
    expect(await runCommandDocument(db, PATH, COMMAND, 'ada', run)).toBeNull();
    expect(await stored()).toBeUndefined();
  });

  it('copes with a command deleted while it ran', async () => {
    const run = runner(async () => {
      // The player's account deletion took it meanwhile.
      await db.doc(PATH).delete();
      return { ok: true };
    });
    expect(await runCommandDocument(db, PATH, COMMAND, 'ada', run)).toEqual({
      ok: true,
    });
    expect((await db.doc(PATH).get()).exists).toBe(false);
  });
});
