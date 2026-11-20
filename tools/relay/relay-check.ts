import { chromium, firefox, webkit } from '@playwright/test';
import {
  type RelayEntry,
  relayCredentialsUrl,
  relayEntry,
  type TurnKey,
} from '@wolsok/feat-shared-bacteria-engine/cloud';

/** The credentials' lifetime in the check, in seconds. */
export const CHECK_TTL_S = 60;
/**
 * How long the check holds the channel: 11 minutes, past the credentials'
 * expiry and past Chrome's refresh of the TURN permission (about every 4
 * minutes) and of the allocation (its 10-minute lifetime less a minute),
 * the first moments an expired credential could be refused.
 */
export const CHECK_HOLD_MS = 11 * 60_000;

/**
 * How the check keeps the relay's credentials fresh while it holds the
 * channel: not at all, by `setConfiguration` with new ones every
 * {@link CHECK_REFRESH_MS}, or by that and an ICE restart.
 */
export type RefreshMode = 'none' | 'configure' | 'restart';

/** The browsers the check runs in: Chrome's, Firefox's and Safari's engines. */
export const CHECK_BROWSERS = { chromium, firefox, webkit } as const;
export type CheckBrowser = keyof typeof CHECK_BROWSERS;

/** How often the check takes fresh credentials, well before they expire. */
export const CHECK_REFRESH_MS = 30_000;

/** What the relay check found. */
export interface RelayCheck {
  /** The channel opened, through the relay only. */
  opened: boolean;
  /** The pair ICE picked is a relayed one on both ends. */
  relayed: boolean;
  /** A message arrived across. */
  first: boolean;
  /** A message still arrived once the credentials had expired. */
  afterExpiry: boolean;
}

/** Credentials from the TURN key, valid {@link CHECK_TTL_S}. */
export async function checkCredentials(key: TurnKey): Promise<RelayEntry> {
  const response = await fetch(relayCredentialsUrl(key.id), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: CHECK_TTL_S }),
    signal: AbortSignal.timeout(20_000),
  });
  const entry = response.ok ? relayEntry(await response.json()) : null;
  if (entry === null) {
    throw new Error(
      `Cloudflare handed out no TURN server (${response.status}).`
    );
  }
  return entry;
}

/**
 * Two connections in one browser page that may reach each other only
 * through `relay` (`iceTransportPolicy: 'relay'`), as two devices behind
 * strict NATs: whether their channel opens, carries a message, and still
 * carries one {@link CHECK_HOLD_MS} later, past the credentials' expiry.
 */
export async function checkRelay(
  relay: RelayEntry,
  fresh: () => Promise<RelayEntry>,
  mode: RefreshMode = 'none',
  browserName: CheckBrowser = 'chromium',
  holdMs = CHECK_HOLD_MS
): Promise<RelayCheck> {
  const browser = await CHECK_BROWSERS[browserName].launch();
  try {
    const page = await browser.newPage();
    // tsx names the functions it compiles with an `__name` helper, which
    // the page does not have.
    await page.evaluate('globalThis.__name = (fn) => fn');
    await page.exposeFunction('freshRelay', fresh);
    return await page.evaluate(
      async ({ relay, holdMs, mode, refreshMs }) => {
        const config: RTCConfiguration = {
          iceServers: [relay],
          iceTransportPolicy: 'relay',
        };
        const a = new RTCPeerConnection(config);
        const b = new RTCPeerConnection(config);
        a.onicecandidate = ({ candidate }) =>
          candidate && void b.addIceCandidate(candidate);
        b.onicecandidate = ({ candidate }) =>
          candidate && void a.addIceCandidate(candidate);
        const options = { negotiated: true, id: 0, ordered: true };
        const out = a.createDataChannel('check', options);
        const into = b.createDataChannel('check', options);
        const received: string[] = [];
        into.onmessage = ({ data }) => received.push(String(data));
        const wait = (ms: number) =>
          new Promise((resolve) => setTimeout(resolve, ms));
        const until = async (done: () => boolean, ms: number) => {
          for (let left = ms; left > 0 && !done(); left -= 100) {
            await wait(100);
          }
          return done();
        };

        const negotiate = async () => {
          await a.setLocalDescription(await a.createOffer());
          await b.setRemoteDescription(
            a.localDescription as RTCSessionDescription
          );
          await b.setLocalDescription(await b.createAnswer());
          await a.setRemoteDescription(
            b.localDescription as RTCSessionDescription
          );
        };
        await negotiate();

        const opened = await until(() => out.readyState === 'open', 20_000);
        let relayed = false;
        const stats = await a.getStats();
        stats.forEach((report) => {
          if (report.type === 'transport' && report.selectedCandidatePairId) {
            const pair = stats.get(report.selectedCandidatePairId);
            relayed =
              stats.get(pair?.localCandidateId)?.candidateType === 'relay' &&
              stats.get(pair?.remoteCandidateId)?.candidateType === 'relay';
          }
        });
        if (opened) {
          out.send('first');
        }
        const first = await until(() => received.includes('first'), 10_000);
        const freshRelay = (
          globalThis as unknown as {
            freshRelay: () => Promise<RTCIceServer>;
          }
        ).freshRelay;
        for (let held = 0; held < holdMs; held += refreshMs) {
          await wait(Math.min(refreshMs, holdMs - held));
          if (mode !== 'none' && held + refreshMs < holdMs) {
            const next = await freshRelay();
            for (const connection of [a, b]) {
              connection.setConfiguration({
                iceServers: [next],
                iceTransportPolicy: 'relay',
              });
            }
            if (mode === 'restart') {
              a.restartIce();
              await negotiate();
            }
          }
        }
        if (out.readyState === 'open') {
          out.send('after');
        }
        const afterExpiry = await until(
          () => received.includes('after'),
          10_000
        );
        a.close();
        b.close();
        return { opened, relayed, first, afterExpiry };
      },
      { relay, holdMs, mode, refreshMs: CHECK_REFRESH_MS }
    );
  } finally {
    await browser.close();
  }
}
