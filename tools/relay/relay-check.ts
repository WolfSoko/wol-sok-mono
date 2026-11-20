import { chromium } from '@playwright/test';
import {
  type RelayEntry,
  relayCredentialsUrl,
  relayEntry,
} from '@wolsok/feat-shared-bacteria-engine/cloud';

/** The credentials' lifetime in the check, in seconds. */
export const CHECK_TTL_S = 60;
/** How long the check holds the channel: past the credentials' expiry. */
export const CHECK_HOLD_MS = 120_000;

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
export async function checkCredentials(key: {
  id: string;
  token: string;
}): Promise<RelayEntry> {
  const response = await fetch(relayCredentialsUrl(key.id), {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ttl: CHECK_TTL_S }),
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
 * Two connections in one Chromium page that may reach each other only
 * through `relay` (`iceTransportPolicy: 'relay'`), as two devices behind
 * strict NATs: whether their channel opens, carries a message, and still
 * carries one {@link CHECK_HOLD_MS} later, past the credentials' expiry.
 */
export async function checkRelay(
  relay: RelayEntry,
  holdMs = CHECK_HOLD_MS
): Promise<RelayCheck> {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // tsx names the functions it compiles with an `__name` helper, which
    // the page does not have.
    await page.evaluate('globalThis.__name = (fn) => fn');
    return await page.evaluate(
      async ({ relay, holdMs }) => {
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

        await a.setLocalDescription(await a.createOffer());
        await b.setRemoteDescription(
          a.localDescription as RTCSessionDescription
        );
        await b.setLocalDescription(await b.createAnswer());
        await a.setRemoteDescription(
          b.localDescription as RTCSessionDescription
        );

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
        await wait(holdMs);
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
      { relay, holdMs }
    );
  } finally {
    await browser.close();
  }
}
