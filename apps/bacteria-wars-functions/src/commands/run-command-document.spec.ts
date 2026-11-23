import type { Firestore } from 'firebase-admin/firestore';
import { logger } from 'firebase-functions/logger';
import { runCommandDocument } from './run-command-document';

/** A Firestore whose every update fails, as on a timeout. */
function failingDb(writeError: Error): Firestore {
  return {
    doc: () => ({ update: () => Promise.reject(writeError) }),
  } as unknown as Firestore;
}

describe('runCommandDocument', () => {
  afterEach(() => jest.restoreAllMocks());

  it("throws the command's error on, not the failed write of its answer", async () => {
    const log = jest.spyOn(logger, 'error').mockImplementation(() => undefined);
    const failure = new Error('boom');
    const writeError = new Error('deadline exceeded');
    await expect(
      runCommandDocument(
        failingDb(writeError),
        'replayCommands/c1',
        { uid: 'ada' },
        'ada',
        async () => {
          throw failure;
        }
      )
    ).rejects.toBe(failure);
    expect(log).toHaveBeenCalledWith('Could not answer a failed command', {
      path: 'replayCommands/c1',
      error: writeError,
    });
  });
});
