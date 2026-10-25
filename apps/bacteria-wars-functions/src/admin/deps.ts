/**
 * What the admin functions reach beyond Firestore (ADR 0012), passed in so
 * the handlers stay testable on the emulator: the Auth accounts, the
 * Realtime Database and the tombstone secret. `main.ts` builds the real
 * ones.
 */

/** What the admin functions need to know of an account. */
export interface AccountRecord {
  /** The account's `google.com` provider uid, null without Google. */
  googleUid: string | null;
  /** True for the owner: the `admin` claim on a verified Google account. */
  admin: boolean;
}

/** The few Realtime Database writes and reads the functions make. */
export interface Rtdb {
  set(path: string, value: unknown): Promise<void>;
  remove(path: string): Promise<void>;
  get(path: string): Promise<unknown>;
}

export interface AdminDeps {
  /** The account of `uid` - null when there is none (deleted). */
  account(uid: string): Promise<AccountRecord | null>;
  /** Every account uid, a page at a time - for `stats.recount`. */
  listUids(pageToken?: string): Promise<{ uids: string[]; next?: string }>;
  rtdb: Rtdb;
  /** `BAN_TOMBSTONE_KEY`, the HMAC key of ban tombstones. */
  tombstoneKey(): string;
}
