import rules from '../../firestore.rules?raw';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ADMIN_CLAIM } from './admin-api';

// read as text: importing the script would run it
const grantAdminScript = readFileSync(
  join(__dirname, '../../scripts/grant-admin.mjs'),
  'utf8'
);

describe('admin API', () => {
  it('names the same claim as firestore.rules and the grant-admin script', () => {
    expect(grantAdminScript).toContain(`const ADMIN_CLAIM = '${ADMIN_CLAIM}';`);
    expect(rules).toContain(
      `request.auth.token.get('${ADMIN_CLAIM}', false) == true`
    );
  });
});
