/**
 * The code the TURN relay article quotes, kept out of its templates, where
 * every brace would need escaping. Shortened from the game's sources; no
 * value in them is a real credential.
 */
export const TURN_RELAY_SNIPPETS = {
  relayDocument: `// Firestore: relay/turn, written by refreshRelay every 30 minutes
{
  urls: ['turn:turn.cloudflare.com:3478?transport=udp', /* … */],
  username: '<short-lived>',
  credential: '<short-lived>',
  expireAt: Timestamp,   // now + 1 h
  refreshedAt: Timestamp,
}`,
  peerConnection: `const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

// relay: the TURN entry of relay/turn, or [] when there is none
const connection = new RTCPeerConnection({
  iceServers: [...STUN_SERVERS, ...relay],
});`,
  refresh: `export const refreshRelay = onSchedule(
  {
    schedule: 'every 30 minutes',
    maxInstances: 1,
    retryCount: 0,
    secrets: [CLOUDFLARE_TURN_KEY], // the TURN key, never the account token
  },
  withSentry(() =>
    refreshRelayOf(db(), parseTurnKey(CLOUDFLARE_TURN_KEY.value()), fetch, Date.now())
  )
);

// refreshRelayOf: POST { ttl: 3600 } to Cloudflare's generate-ice-servers,
// keep only the TURN entry, drop port 53, store it flat:
await db.collection('relay').doc('turn').set({
  ...entry,
  expireAt: Timestamp.fromMillis(now + RELAY_TTL_S * 1000),
  refreshedAt: Timestamp.fromMillis(now),
});`,
  renewal: `// host, every 15 minutes (RELAY_RENEW_MS)
const servers = await relay.fresh();
connection.setConfiguration({ iceServers: iceServers(servers) });
const offer = await connection.createOffer({ iceRestart: true });
await connection.setLocalDescription(offer);
signal.send(JSON.stringify({ t: 'offer', sdp: offer.sdp }));
// guest: fresh credentials too, then answers on the same channel`,
};
