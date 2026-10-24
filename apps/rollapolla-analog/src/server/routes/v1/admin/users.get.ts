import { defineEventHandler, getQuery } from 'h3';
import { listGoogleUsers } from '../../../admin/admin-users';
import { asAdmin } from '../../../admin/firebase-admin';

/** GET /api/v1/admin/users?pageToken=… : users who signed in with Google. */
export default defineEventHandler((event) =>
  asAdmin(event, (auth) => {
    const { pageToken } = getQuery(event);
    return listGoogleUsers(
      auth,
      typeof pageToken === 'string' ? pageToken : undefined
    );
  })
);
