import { emulatorEnv } from './emulator-env';

const NAME = 'SHARED_FIREBASE_EMULATOR_SPEC';

describe('emulatorEnv', () => {
  afterEach(() => {
    delete process.env[NAME];
  });

  it('reads a variable the emulators set', () => {
    process.env[NAME] = '127.0.0.1:8080';

    expect(emulatorEnv(NAME)).toBe('127.0.0.1:8080');
  });

  it('names test-emulator where the variable is missing', () => {
    expect(() => emulatorEnv(NAME)).toThrow(
      `${NAME} is not set: run test-emulator`
    );
  });
});
