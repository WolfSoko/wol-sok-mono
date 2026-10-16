import rules from '../../firestore.rules?raw';
import { ADMIN_CLAIM } from './admin-api';

describe('admin API', () => {
  it('names the same claim as firestore.rules', () => {
    expect(rules).toContain(
      `request.auth.token.get('${ADMIN_CLAIM}', false) == true`
    );
  });
});
