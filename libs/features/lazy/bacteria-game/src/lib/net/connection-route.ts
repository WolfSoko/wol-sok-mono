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
  const pair = selectedPair([...entries.values()], entries);
  if (pair === undefined) {
    return 'unknown';
  }
  const ends = [pair['localCandidateId'], pair['remoteCandidateId']].map(
    (id) => entries.get(String(id))?.['candidateType']
  );
  return ends.includes('relay') ? 'relay' : 'direct';
}

/**
 * The selected candidate pair: the transport's `selectedCandidatePairId`
 * (Chromium, Safari), else the pair marked `selected` (Firefox), else a
 * nominated pair that succeeded.
 */
function selectedPair(
  all: readonly StatsEntry[],
  byId: ReadonlyMap<string, StatsEntry>
): StatsEntry | undefined {
  const pairs = all.filter((entry) => entry.type === 'candidate-pair');
  const selectedId = all.find(
    (entry) => entry.type === 'transport' && entry['selectedCandidatePairId']
  )?.['selectedCandidatePairId'];
  return (
    (selectedId === undefined ? undefined : byId.get(String(selectedId))) ??
    pairs.find((pair) => pair['selected'] === true) ??
    pairs.find(
      (pair) => pair['nominated'] === true && pair['state'] === 'succeeded'
    )
  );
}
