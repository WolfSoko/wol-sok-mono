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

/**
 * A `catch` for a write to a document that may be gone: lets a gRPC
 * `not-found` pass (TTL or an account's erasure took the document
 * meanwhile) and rethrows anything else.
 */
export function ignoreNotFound(error: unknown): void {
  if (!hasGrpcCode(error, 5, 'not-found')) {
    throw error;
  }
}
