import { defineEventHandler, readBody } from 'h3';
import { SetRoleDto } from '../../../../shared/admin-api';
import { setAdmin } from '../../../admin/admin-users';
import { asAdmin } from '../../../admin/firebase-admin';

/** POST /api/v1/admin/role { uid, admin }: grants or revokes admin rights. */
export default defineEventHandler((event) =>
  asAdmin(event, async (auth, adminUid) => {
    const body = (await readBody<Partial<SetRoleDto>>(event)) ?? {};
    return setAdmin(auth, adminUid, body.uid, body.admin);
  })
);
