// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  CHOICES_COLLECTION,
  CLUB_INDEX_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
  LEGACY_CHOICES_COLLECTION,
  LEGACY_DELETED_ACCOUNTS_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';

/** The rules as the deploy takes them: they cannot import the names. */
const RULES = readFileSync(
  new URL('../firestore.rules', import.meta.url),
  'utf8'
);

describe('the collections the Firestore rules name', () => {
  // the legacy choices only to read and delete, until #2966's follow-up
  it('are the account lib’s choices and their legacy collection, the only ones a client may open', () => {
    const matched = [
      ...RULES.matchAll(/^\s*match \/(\w+)\/\{[\w=*]+\}\s*\{/gm),
    ].map(([, collection]) => collection);

    expect(matched).toEqual([LEGACY_CHOICES_COLLECTION, CHOICES_COLLECTION]);
  });

  it('leave the club index to the server', () => {
    expect(RULES).not.toContain(CLUB_INDEX_COLLECTION);
  });

  it.each([DELETED_ACCOUNTS_COLLECTION, LEGACY_DELETED_ACCOUNTS_COLLECTION])(
    'look up the tombstones in %s',
    (tombstones) => {
      expect(RULES).toContain(
        `exists(/databases/$(database)/documents/${tombstones}/$(uid))`
      );
    }
  );
});
