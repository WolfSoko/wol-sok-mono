import { emulatorEnv, firestoreEmulatorFromEnv } from './emulator-env';

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

describe('firestoreEmulatorFromEnv', () => {
  const HOST_VARIABLE = 'FIRESTORE_EMULATOR_HOST';
  const before = process.env[HOST_VARIABLE];

  afterEach(() => {
    if (before === undefined) {
      delete process.env[HOST_VARIABLE];
    } else {
      process.env[HOST_VARIABLE] = before;
    }
  });

  it('splits the emulator’s address into host and port', () => {
    process.env[HOST_VARIABLE] = '127.0.0.1:8180';

    expect(firestoreEmulatorFromEnv()).toEqual({
      host: '127.0.0.1',
      port: 8180,
    });
  });

  it('keeps an IPv6 host whole', () => {
    process.env[HOST_VARIABLE] = '[::1]:8180';

    expect(firestoreEmulatorFromEnv()).toEqual({ host: '[::1]', port: 8180 });
  });
});
