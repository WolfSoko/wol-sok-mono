import type { IdTokenResult } from 'firebase/auth';

/**
 * Whether a sign-in token is the owner's (ADR 0012): the `admin` claim, a
 * verified email and a Google sign-in - the same three facts the rules'
 * `isAdmin()` checks. A courtesy for what to show: the rules and the
 * functions are the lock. Pure.
 */
export function isOwnerToken(
  token: Pick<IdTokenResult, 'claims' | 'signInProvider'>
): boolean {
  return (
    token.claims['admin'] === true &&
    token.claims['email_verified'] === true &&
    token.signInProvider === 'google.com'
  );
}
