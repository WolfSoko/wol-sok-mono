/** A TURN key as Cloudflare lists it - its secret is shown only once. */
export interface ListedTurnKey {
  uid: string;
  name: string;
}

/** What `turn-key` does about the TURN key. */
export type TurnKeyPlan =
  /** The key the secret names stays; `remove` are older ones of its name. */
  | { action: 'keep'; uid: string; remove: string[] }
  /**
   * A new key, its secret stored, then `remove` - every older one of the
   * name, whose secret nobody holds any more.
   */
  | { action: 'create'; remove: string[] };

/**
 * Whether the TURN key named `name` is in place: one the secret
 * `CLOUDFLARE_TURN_KEY` names (`storedUid`, null for no secret) is kept,
 * else a new one is made, since Cloudflare shows a key's secret only when
 * it creates it. Keys of other names are never touched.
 */
export function planTurnKey(
  keys: readonly ListedTurnKey[],
  storedUid: string | null,
  name: string
): TurnKeyPlan {
  const ours = keys.filter((key) => key.name === name).map((key) => key.uid);
  if (storedUid !== null && ours.includes(storedUid)) {
    return {
      action: 'keep',
      uid: storedUid,
      remove: ours.filter((uid) => uid !== storedUid),
    };
  }
  return { action: 'create', remove: ours };
}
