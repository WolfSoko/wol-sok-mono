/** A variable `firebase emulators:exec` sets: missing outside test-emulator. */
export function emulatorEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined) {
    throw new Error(`${name} is not set: run test-emulator`);
  }
  return value;
}
