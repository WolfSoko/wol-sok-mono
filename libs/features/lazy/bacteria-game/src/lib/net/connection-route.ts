/**
 * How an online link carries the match: `direct` between the two devices,
 * `relay` through the TURN relay (ADR 0020), `unknown` where the browser's
 * statistics name no path.
 */
export type ConnectionRoute = 'direct' | 'relay' | 'unknown';

/** The entries of an `RTCStatsReport` the route is read from. */
type StatsEntry = Record<string, unknown> & { id: string; type: string };

/**
 * The route of the candidate pair ICE selected, from the connection's
 * statistics: `relay` when either end of it is a relay candidate - with one
 * device behind a strict NAT only that one asks the relay, the other sees
 * it as the remote candidate - so both devices report the same route.
 */
export function connectionRoute(stats: RTCStatsReport): ConnectionRoute {
  const entries = new Map<string, StatsEntry>();
  stats.forEach((entry: StatsEntry) => entries.set(entry.id, entry));
  const pair = selectedPair(entries);
  const ends = [
    textOf(pair, 'localCandidateId'),
    textOf(pair, 'remoteCandidateId'),
  ].map((id) => textOf(entryOf(entries, id), 'candidateType'));
  if (ends.includes(undefined)) {
    return 'unknown';
  }
  return ends.includes('relay') ? 'relay' : 'direct';
}

/**
 * The selected candidate pair: the transport's `selectedCandidatePairId`
 * (Chromium, Safari), else the pair marked `selected` (Firefox), else a
 * nominated pair that succeeded.
 */
function selectedPair(
  byId: ReadonlyMap<string, StatsEntry>
): StatsEntry | undefined {
  const all = [...byId.values()];
  const pairs = all.filter((entry) => entry.type === 'candidate-pair');
  const transport = all.find(
    (entry) =>
      entry.type === 'transport' &&
      textOf(entry, 'selectedCandidatePairId') !== undefined
  );
  return (
    entryOf(byId, textOf(transport, 'selectedCandidatePairId')) ??
    pairs.find((pair) => pair['selected'] === true) ??
    pairs.find(
      (pair) => pair['nominated'] === true && pair['state'] === 'succeeded'
    )
  );
}

/** The entry's field `key` where it is a text, else undefined. */
function textOf(
  entry: StatsEntry | undefined,
  key: string
): string | undefined {
  const value = entry?.[key];
  return typeof value === 'string' ? value : undefined;
}

/** The entry with `id`, none without an id. */
function entryOf(
  byId: ReadonlyMap<string, StatsEntry>,
  id: string | undefined
): StatsEntry | undefined {
  return id === undefined ? undefined : byId.get(id);
}
