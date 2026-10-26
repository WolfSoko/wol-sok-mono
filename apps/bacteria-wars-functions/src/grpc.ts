/**
 * True for a Firestore error with the gRPC status `code` - given as the
 * number or, by some clients, as its name (`name`, e.g. `already-exists`).
 */
export function hasGrpcCode(
  error: unknown,
  code: number,
  name: string
): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error.code === code || error.code === name)
  );
}
