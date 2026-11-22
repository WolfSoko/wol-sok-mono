/**
 * The uid a Firebase custom token signs in to - null for anything that is
 * no such token. A custom token is a JWT whose payload names the `uid`;
 * read without checking the signature, which is Firebase Auth's to check.
 */
export function customTokenUid(token: string): string | null {
  const payload = token.split('.')[1];
  if (payload === undefined) {
    return null;
  }
  try {
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const uid: unknown = (JSON.parse(json) as Record<string, unknown>)['uid'];
    return typeof uid === 'string' && uid.length > 0 ? uid : null;
  } catch {
    return null;
  }
}
