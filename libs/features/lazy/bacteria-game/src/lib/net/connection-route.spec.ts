import { connectionRoute } from './connection-route';

type Entry = Record<string, unknown> & { id: string; type: string };

/** A stats report of `entries`, as `getStats()` resolves it. */
function report(...entries: Entry[]): RTCStatsReport {
  return new Map(
    entries.map((entry) => [entry.id, entry])
  ) as unknown as RTCStatsReport;
}

const candidate = (id: string, candidateType: string): Entry => ({
  id,
  type: id.startsWith('L') ? 'local-candidate' : 'remote-candidate',
  candidateType,
});

const pair = (
  id: string,
  local: string,
  remote: string,
  extra: Record<string, unknown> = {}
): Entry => ({
  id,
  type: 'candidate-pair',
  localCandidateId: local,
  remoteCandidateId: remote,
  ...extra,
});

/** Two pairs: `P1` direct (host to srflx), `P2` through the relay. */
const candidates = [
  candidate('L1', 'host'),
  candidate('R1', 'srflx'),
  candidate('L2', 'relay'),
  candidate('R2', 'relay'),
];

describe('connectionRoute', () => {
  it("takes the transport's selected pair (Chromium, Safari)", () => {
    const stats = (selected: string) =>
      report(
        ...candidates,
        pair('P1', 'L1', 'R1', { nominated: true, state: 'succeeded' }),
        pair('P2', 'L2', 'R2'),
        { id: 'T', type: 'transport', selectedCandidatePairId: selected }
      );

    expect(connectionRoute(stats('P2'))).toBe('relay');
    expect(connectionRoute(stats('P1'))).toBe('direct');
  });

  it('takes the pair marked selected (Firefox)', () => {
    const stats = report(
      ...candidates,
      pair('P1', 'L1', 'R1', { selected: false }),
      pair('P2', 'L2', 'R2', { selected: true })
    );

    expect(connectionRoute(stats)).toBe('relay');
  });

  it('falls back on a nominated pair that succeeded', () => {
    const stats = report(
      ...candidates,
      pair('P1', 'L1', 'R1', { nominated: true, state: 'succeeded' }),
      pair('P2', 'L2', 'R2', { nominated: true, state: 'failed' })
    );

    expect(connectionRoute(stats)).toBe('direct');
  });

  it.each([
    ['the local', 'L2', 'R1'],
    ['the remote', 'L1', 'R2'],
  ])(
    'counts a relay candidate on %s end as the relay',
    (_end, local, remote) => {
      const stats = report(
        ...candidates,
        pair('P', local, remote, { selected: true })
      );

      expect(connectionRoute(stats)).toBe('relay');
    }
  );

  it.each(['host', 'srflx', 'prflx'])(
    'counts %s on both ends as direct',
    (type) => {
      const stats = report(
        candidate('L', type),
        candidate('R', type),
        pair('P', 'L', 'R', { selected: true })
      );

      expect(connectionRoute(stats)).toBe('direct');
    }
  );

  it('falls back when the transport names a pair the report lacks', () => {
    const stats = report(
      ...candidates,
      pair('P2', 'L2', 'R2', { selected: true }),
      { id: 'T', type: 'transport', selectedCandidatePairId: 'gone' }
    );

    expect(connectionRoute(stats)).toBe('relay');
  });

  it('falls back on a transport that selected no pair yet', () => {
    const stats = report(
      ...candidates,
      pair('P1', 'L1', 'R1', { nominated: true, state: 'succeeded' }),
      { id: 'T', type: 'transport' }
    );

    expect(connectionRoute(stats)).toBe('direct');
  });

  it('knows no route when a candidate of the selected pair is missing', () => {
    const stats = report(
      candidate('L1', 'host'),
      pair('P', 'L1', 'R9', { selected: true })
    );

    expect(connectionRoute(stats)).toBe('unknown');
  });

  it('knows no route without a selected pair', () => {
    expect(connectionRoute(report())).toBe('unknown');
    expect(
      connectionRoute(
        report(...candidates, pair('P1', 'L1', 'R1', { state: 'in-progress' }))
      )
    ).toBe('unknown');
  });
});
