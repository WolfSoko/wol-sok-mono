import { getApps, initializeApp } from 'firebase-admin/app';
import { Auth, getAuth } from 'firebase-admin/auth';
import { createError, getHeader, H3Event } from 'h3';
import { AdminApiError, requireAdmin } from './admin-users';

const PROJECT_ID = 'rollapolla-v1';

/**
 * Firebase Auth with the Admin SDK. In Cloud Functions (K_SERVICE is set) it
 * uses the function's own service account; anywhere else, e.g. `nx serve`,
 * it talks to the Auth emulator, like the browser does there.
 */
export function adminAuth(): Auth {
  if (
    !process.env['K_SERVICE'] &&
    !process.env['FIREBASE_AUTH_EMULATOR_HOST']
  ) {
    process.env['FIREBASE_AUTH_EMULATOR_HOST'] = '127.0.0.1:9099';
  }
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
