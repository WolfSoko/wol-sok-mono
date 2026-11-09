import { getAuth } from 'firebase-admin/auth';
import { useEmulatorAdmin } from '../testing/emulator';
import { authAccounts, GET_USERS_LIMIT } from './auth-accounts';

useEmulatorAdmin();

describe('authAccounts', () => {
  const auth = () => getAuth();
  const LIVING = 'living-parent';

  beforeEach(async () => {
    const { users } = await auth().listUsers();
    await auth().deleteUsers(users.map((user) => user.uid));
    await auth().createUser({ uid: LIVING });
  });

  it('names the uids Auth does not know, not those it does', async () => {
    const missing = await authAccounts(auth()).missing([LIVING, 'gone']);

    expect([...missing]).toEqual(['gone']);
  });

  it(`looks up more than ${GET_USERS_LIMIT} uids in batches`, async () => {
    const gone = Array.from(
      { length: GET_USERS_LIMIT + 5 },
      (_, i) => `gone-${i}`
    );

    const missing = await authAccounts(auth()).missing([...gone, LIVING]);

    expect([...missing].sort()).toEqual([...gone].sort());
  });

  it('looks up nothing for no uids', async () => {
    expect((await authAccounts(auth()).missing([])).size).toBe(0);
  });
});
