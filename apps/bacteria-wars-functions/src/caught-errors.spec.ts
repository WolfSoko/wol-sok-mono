import { logger } from 'firebase-functions/logger';
import {
  logCaughtError,
  reportCaughtErrorsTo,
  withoutMessage,
} from './caught-errors';

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

describe('withoutMessage', () => {
  it('keeps the name and the frames, not the message or the cause', () => {
    const error = new SyntaxError('Unexpected token: "bad token ya29.secret"', {
      cause: new Error('ya29.secret'),
    });

    const stripped = withoutMessage(error);

    expect(stripped).toBeInstanceOf(Error);
    expect(stripped.name).toBe('SyntaxError');
    expect(stripped.message).toBe('');
    expect(stripped.cause).toBeUndefined();
    expect(stripped.stack?.split('\n')[0]).toBe('SyntaxError');
    expect(stripped.stack).toContain('caught-errors.spec.ts');
    expect(JSON.stringify([stripped.stack, stripped.message])).not.toContain(
      'ya29'
    );
  });

  it('drops a message that spans lines', () => {
    const error = new Error('first line\n    at ya29.secret line');
    const { stack } = withoutMessage(error);
    expect(stack).not.toContain('ya29');
    expect(stack).toContain('caught-errors.spec.ts');
  });

  it('keeps no frame of a stack it cannot tell from its message', () => {
    const error = new Error('ya29.secret');
    error.stack = 'rewritten ya29.secret\n    at somewhere';
    expect(withoutMessage(error).stack).toBe('Error');
  });

  it('names what is no Error unknown', () => {
    const stripped = withoutMessage('ya29.secret');
    expect(stripped.name).toBe('unknown');
    expect(stripped.stack).toBe('unknown');
  });
});
