import type { RelayServer } from '../storage/game-relay';

/**
 * Public STUN servers, which tell a device the address the internet sees it
 * under. Two devices behind strict NATs - some mobile networks, some
 * Wi-Fi networks - cannot reach each other that way; for them the
 * connection goes through the TURN relay (ADR 0020), and without one they
 * are told so.
 */
const STUN_SERVERS: RTCIceServer[] = [
  { urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302'] },
];

/** The servers a connection reaches the other device through. */
export function iceServers(relay: readonly RelayServer[]): RTCIceServer[] {
  return [...STUN_SERVERS, ...relay];
}
