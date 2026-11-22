import type { Auth, UserRecord } from 'firebase-admin/auth';

/**
 * The Auth user, read afresh - null for one that does not exist; other
 * failures throw.
 */
export async function userRecordOf(
  auth: Pick<Auth, 'getUser'>,
  uid: string
): Promise<UserRecord | null> {
  try {
    return await auth.getUser(uid);
  } catch (error) {
    if ((error as { code?: unknown } | null)?.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}
