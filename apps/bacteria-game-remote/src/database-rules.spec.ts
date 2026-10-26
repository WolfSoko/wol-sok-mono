import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The Realtime Database rules (`../database.rules.json`): the friend lists'
 * mirrors, which the functions keep with the admin SDK (ADR 0012, owner's
 * decision of 2026-10-26), stay closed to every client - they say who is
 * whose friend.
 */
describe('database.rules.json', () => {
  const { rules } = JSON.parse(
    readFileSync(join(__dirname, '../database.rules.json'), 'utf8')
  ) as { rules: Record<string, Record<string, unknown>> };

  for (const node of ['statusReaders', 'listedBy']) {
    it(`lets no client read or write ${node}`, () => {
      expect(rules[node]).toEqual({ '.read': false, '.write': false });
    });
  }
});
