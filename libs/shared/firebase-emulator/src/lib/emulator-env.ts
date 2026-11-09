/** Where a spec's Firestore emulator listens. */
export interface FirestoreEmulator {
  readonly host: string;
  readonly port: number;
}

/** A variable `firebase emulators:exec` sets: missing outside test-emulator. */
export function emulatorEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is not set: run test-emulator`);
  }
  return value;
}

/**
 * The Firestore emulator `firebase emulators:exec` started, from
 * `FIRESTORE_EMULATOR_HOST` (`host:port`; the host may be an IPv6 address
 * such as `[::1]`, so the port is what follows the last colon).
 */
export function firestoreEmulatorFromEnv(): FirestoreEmulator {
  const address = emulatorEnv('FIRESTORE_EMULATOR_HOST');
  const colon = address.lastIndexOf(':');
  return {
    host: address.slice(0, colon),
    port: Number(address.slice(colon + 1)),
  };
}
