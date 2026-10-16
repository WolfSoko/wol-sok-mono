import { defineEventHandler } from 'h3';
import { countUsers } from '../../../admin/admin-users';
import { asAdmin } from '../../../admin/firebase-admin';

/** GET /api/v1/admin/user-stats */
export default defineEventHandler((event) =>
  asAdmin(event, (auth) => countUsers(auth))
);
