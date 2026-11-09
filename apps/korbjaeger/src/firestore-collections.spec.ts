// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  CHOICES_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';

/** The rules as the deploy takes them: they cannot import the names. */
const RULES = readFileSync(
  new URL('../firestore.rules', import.meta.url),
  'utf8'
);

describe('the collections the Firestore rules name', () => {
  it('are the account lib’s choices, the only collection a client may open', () => {
    const matched = [...RULES.matchAll(/^\s*match \/(\w+)\/\{uid\}/gm)].map(
      ([, collection]) => collection
    );

    expect(matched).toEqual([CHOICES_COLLECTION]);
  });

  it('look up the tombstones in the account lib’s collection', () => {
    expect(RULES).toContain(
      `exists(/databases/$(database)/documents/${DELETED_ACCOUNTS_COLLECTION}/$(uid))`
    );
  });
});
