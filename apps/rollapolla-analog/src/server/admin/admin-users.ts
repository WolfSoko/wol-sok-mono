import type { Auth, UserRecord } from 'firebase-admin/auth';
import {
  ADMIN_CLAIM,
  AppUserDto,
  UserStatsDto,
  UsersPageDto,
} from '../../shared/admin-api';

/** Firebase Auth hands out at most 1000 users per page. */
const AUTH_PAGE_SIZE = 1000;

/**
 * Auth pages mix in the anonymous users. A request reads this many pages at
 * most while looking for Google users, so it never runs for long.
 */
const MAX_AUTH_PAGES_PER_REQUEST = 10;

/** Why a request was refused; the routes turn it into the HTTP status. */
export class AdminApiError extends Error {
  constructor(
    public readonly status: 400 | 401 | 403 | 404,
    message: string
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

export function isAdminUser(user: Pick<UserRecord, 'customClaims'>): boolean {
  return user.customClaims?.[ADMIN_CLAIM] === true;
}

function isGoogleUser(user: Pick<UserRecord, 'providerData'>): boolean {
  return user.providerData.some(
    ({ providerId }) => providerId === 'google.com'
  );
}

/**
 * The uid of the admin behind `authorization` ("Bearer <ID token>").
 * Reads the admin claim from the user record, not the token: a revoked
 * admin is refused at once, not only once their token expires.
 */
export async function requireAdmin(
  auth: Auth,
  authorization: string | undefined
): Promise<string> {
  const idToken = /^Bearer (.+)$/.exec(authorization ?? '')?.[1];
  if (!idToken) {
    throw new AdminApiError(401, 'Sign in first');
  }
  let uid: string;
  try {
    ({ uid } = await auth.verifyIdToken(idToken));
  } catch {
    throw new AdminApiError(401, 'Sign in again');
  }
  let user: UserRecord;
  try {
    user = await auth.getUser(uid);
  } catch {
    // deleted or disabled since the token was issued
    throw new AdminApiError(401, 'Sign in again');
  }
  if (!isGoogleUser(user) || !isAdminUser(user)) {
    throw new AdminApiError(403, 'Admins only');
  }
  return uid;
}

export function toAppUserDto(user: UserRecord): AppUserDto {
  const google = user.providerData.find(
    ({ providerId }) => providerId === 'google.com'
  );
  return {
    uid: user.uid,
    displayName: user.displayName ?? google?.displayName ?? null,
    email: user.email ?? google?.email ?? null,
    photoUrl: user.photoURL ?? google?.photoURL ?? null,
    createdAt: new Date(user.metadata.creationTime).toISOString(),
    lastSignInAt: user.metadata.lastSignInTime
      ? new Date(user.metadata.lastSignInTime).toISOString()
      : null,
    isAdmin: isAdminUser(user),
  };
}

/**
 * The next Google users of Firebase Auth. Skips pages holding only
 * anonymous users, up to {@link MAX_AUTH_PAGES_PER_REQUEST}; so the page is
 * empty only at the end, or after that many anonymous-only pages.
 */
export async function listGoogleUsers(
  auth: Auth,
  pageToken: string | undefined
): Promise<UsersPageDto> {
  let next = pageToken || undefined;
  const users: AppUserDto[] = [];
  for (let read = 0; read < MAX_AUTH_PAGES_PER_REQUEST; read++) {
    const page = await auth.listUsers(AUTH_PAGE_SIZE, next);
    users.push(...page.users.filter(isGoogleUser).map(toAppUserDto));
    next = page.pageToken;
    if (users.length > 0 || !next) {
      break;
    }
  }
  return { users, nextPageToken: next ?? null };
}

/** Walks all Auth users: fine for thousands, not for millions. */
export async function countUsers(auth: Auth): Promise<UserStatsDto> {
  const stats: UserStatsDto = { users: 0, anonymous: 0, admins: 0 };
  let pageToken: string | undefined;
  do {
    const page = await auth.listUsers(AUTH_PAGE_SIZE, pageToken);
    for (const user of page.users) {
      if (isGoogleUser(user)) {
        stats.users++;
      } else {
        stats.anonymous++;
      }
      if (isGoogleUser(user) && isAdminUser(user)) {
        stats.admins++;
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return stats;
}

/**
 * Grants or revokes the admin claim, keeping the user's other claims. Only
 * Google accounts can be admins, and nobody revokes their own rights, so one
 * admin always remains. The user's token picks the change up on its next
 * refresh (within the hour), or at once when their browser forces one.
 */
export async function setAdmin(
  auth: Auth,
  callerUid: string,
  uid: unknown,
  admin: unknown
): Promise<AppUserDto> {
  if (typeof uid !== 'string' || !uid || typeof admin !== 'boolean') {
    throw new AdminApiError(400, 'Expected { uid: string, admin: boolean }');
  }
  if (uid === callerUid && !admin) {
    throw new AdminApiError(400, 'You cannot revoke your own admin rights');
  }
  let user: UserRecord;
  try {
    user = await auth.getUser(uid);
  } catch {
    throw new AdminApiError(404, 'No such user');
  }
  if (admin && !isGoogleUser(user)) {
    throw new AdminApiError(400, 'Only Google accounts can be admins');
  }
  const { [ADMIN_CLAIM]: _old, ...otherClaims } = user.customClaims ?? {};
  await auth.setCustomUserClaims(
    uid,
    admin ? { ...otherClaims, [ADMIN_CLAIM]: true } : otherClaims
  );
  return toAppUserDto(await auth.getUser(uid));
}
