// @vitest-environment node
import { readFileSync } from 'node:fs';
import {
  CHOICES_COLLECTION,
  CLUB_INDEX_COLLECTION,
  DELETED_ACCOUNTS_COLLECTION,
} from '@wolsok/feat-shared-korbjaeger-account';
import { treffer } from './testing/app-quellen';

/** The rules as the deploy takes them: they cannot import the names. */
const RULES = readFileSync(
  new URL('../firestore.rules', import.meta.url),
  'utf8'
);

describe('the collections the Firestore rules name', () => {
  it('are the account lib’s choices, the only ones a client may open', () => {
    const matched = treffer(RULES, /^\s*match \/(\w+)\/\{[\w=*]+\}\s*\{/gm);

    expect(matched).toEqual([CHOICES_COLLECTION]);
  });

  it('leave the club index to the server', () => {
    expect(RULES).not.toContain(CLUB_INDEX_COLLECTION);
  });

  it('look up the tombstones in the account lib’s collection only', () => {
    const lookedUp = treffer(
      RULES,
      /exists\(\/databases\/\$\(database\)\/documents\/(\w+)\//g
    );

    expect(lookedUp).toEqual([DELETED_ACCOUNTS_COLLECTION]);
  });
});
