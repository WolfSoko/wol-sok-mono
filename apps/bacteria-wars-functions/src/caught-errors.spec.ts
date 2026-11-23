import { logger } from 'firebase-functions/logger';
import { logCaughtError, reportCaughtErrorsTo } from './caught-errors';

jest.mock('firebase-functions/logger', () => ({
  logger: { error: jest.fn() },
}));

describe('caught errors', () => {
  afterEach(() => {
    reportCaughtErrorsTo(null);
    jest.clearAllMocks();
  });

  it('are logged with their fields and handed to the sink', () => {
    const sink = jest.fn();
    reportCaughtErrorsTo(sink);
    const error = new Error('Firestore is down');

    logCaughtError('Could not lift an ended ban', { uid: 'u1', error });

    expect(logger.error).toHaveBeenCalledWith('Could not lift an ended ban', {
      uid: 'u1',
      error,
    });
    expect(sink).toHaveBeenCalledWith(error, 'Could not lift an ended ban');
  });

  it('are only logged while no sink is set', () => {
    const sink = jest.fn();
    reportCaughtErrorsTo(sink);
    reportCaughtErrorsTo(null);

    logCaughtError('Could not write the statistics', { error: 'boom' });

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(sink).not.toHaveBeenCalled();
  });
});
