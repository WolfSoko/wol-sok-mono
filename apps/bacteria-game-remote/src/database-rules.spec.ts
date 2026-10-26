import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Realtime Database rules (`../database.rules.json`): the friend lists'
 * mirrors, which the functions keep with the admin SDK (ADR 0012, owner's
 * decision of 2026-10-26), stay closed to every client - they say who is
 * whose friend - and the online status is read only by the player and
 * those they list as a friend (`statusReaders`).
 */
describe('database.rules.json', () => {
  const { rules } = JSON.parse(
    readFileSync(join(__dirname, '../database.rules.json'), 'utf8')
  ) as { rules: Record<string, Record<string, unknown>> };

  it("lets only the player and those they list as a friend read the player's status", () => {
    const status = rules['status'] as Record<string, Record<string, unknown>>;

    expect(status['$uid']['.read']).toBe(
      "auth != null && (auth.uid === $uid || root.child('statusReaders').child($uid).child(auth.uid).exists())"
    );
    // Nobody lists a whole node of statuses.
    expect(status['.read']).toBeUndefined();
  });

  for (const node of ['statusReaders', 'listedBy']) {
    it(`lets no client read or write ${node}`, () => {
      expect(rules[node]).toEqual({ '.read': false, '.write': false });
    });
  }
});
