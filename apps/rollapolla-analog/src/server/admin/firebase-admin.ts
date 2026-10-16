import { getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { createError, getHeader, H3Event } from 'h3';
import { AdminApiError, requireAdmin } from './admin-users';

const PROJECT_ID = 'rollapolla-v1';

/**
 * Firebase Auth with the Admin SDK and the function's own service account.
 * In development mode vite.config.ts sets FIREBASE_AUTH_EMULATOR_HOST, so
 * the server uses the Auth emulator exactly when the browser does.
 */
export function adminAuth(): Auth {
  const app = getApps()[0] ?? initializeApp({ projectId: PROJECT_ID });
  return getAuth(app);
}

/**
 * Runs `handle` for the admin who sent the event, with their uid; turns
 * refusals into HTTP errors.
 */
export async function asAdmin<T>(
  event: H3Event,
  handle: (auth: Auth, adminUid: string) => Promise<T>
): Promise<T> {
  const auth = adminAuth();
  try {
    const uid = await requireAdmin(auth, getHeader(event, 'authorization'));
    return await handle(auth, uid);
  } catch (error) {
    if (error instanceof AdminApiError) {
      throw createError({
        statusCode: error.status,
        statusMessage: error.message,
      });
    }
    throw error;
  }
}
