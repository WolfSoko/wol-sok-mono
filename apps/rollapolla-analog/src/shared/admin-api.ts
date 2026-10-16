/**
 * What the admin API (src/server/routes/v1/admin) exchanges with the browser.
 * Dates travel as ISO strings.
 */

/** The custom claim on the Firebase Auth user that makes them an admin. */
export const ADMIN_CLAIM = 'admin';

export type AppUserDto = {
  uid: string;
  displayName: string | null;
  email: string | null;
  photoUrl: string | null;
  createdAt: string;
  lastSignInAt: string | null;
  isAdmin: boolean;
};

/** GET /api/v1/admin/users?pageToken=… */
export type UsersPageDto = {
  users: AppUserDto[];
  /** Pass it back for the next page; `null` on the last one. */
  nextPageToken: string | null;
};

/** GET /api/v1/admin/user-stats */
export type UserStatsDto = {
  /** Signed in with Google at least once. */
  users: number;
  /** Never linked to Google: the automatic anonymous sign-in. */
  anonymous: number;
  admins: number;
};

/** POST /api/v1/admin/role */
export type SetRoleDto = { uid: string; admin: boolean };
