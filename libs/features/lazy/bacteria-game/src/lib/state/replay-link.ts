import { BALANCE_VERSION } from './game-balance';
import { DRAG_STEPS, STEER_STEPS } from './match-engine';
import { parseReplay, Replay, ReplayInputs, REPLAY_VERSION } from './replay';

/** The key of a run in the hash of a link: `#ghost=...`. */
const HASH_KEY = 'ghost';

/**
 * The most a run may grow to once unpacked. An hour of turning a stick all
 * the time comes to about 1 MB; a link that unpacks to more is no run, but a
 * way to fill the memory.
 */
const MAX_UNPACKED_BYTES = 2 * 1024 * 1024;

/**
 * A link to the game that carries a run as a ghost to fight: the run packed
 * with deflate and written in base64url into the hash, so it never reaches a
 * server and works wherever the game is served from.
 */
export async function replayLink(
  base: string,
  replay: Replay
): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(pack(replay)));
  const packed = await transform(json, new CompressionStream('deflate-raw'));
  return `${base.split('#')[0]}#${HASH_KEY}=${toBase64Url(packed)}`;
}

/**
 * The run a link's hash carries, null for a hash without one, or with one
 * that is damaged or from another version of the game or its balance.
 */
export async function replayFromHash(hash: string): Promise<Replay | null> {
  const payload = new URLSearchParams(hash.replace(/^#/, '')).get(HASH_KEY);
  if (payload == null || payload === '') {
    return null;
  }
  try {
    const json = await transform(
      fromBase64Url(payload),
      new DecompressionStream('deflate-raw'),
      MAX_UNPACKED_BYTES
    );
    const replay = parseReplay(
      unpack(JSON.parse(new TextDecoder().decode(json)))
    );
    // A ghost of another balance would not play out as it was played.
    return replay?.header.version === REPLAY_VERSION &&
      replay.header.balanceVersion === BALANCE_VERSION
      ? replay
      : null;
  } catch {
    return null;
  }
}

/**
 * How a link packs each kind of input: the key it goes under, the numbers
 * of an entry and the grid its values lie on. The values are written as
 * whole numbers on that grid, each tick as the ticks since the input before
 * - small numbers that pack well.
 */
const KINDS = {
  steers: { key: 's', size: 4, steps: STEER_STEPS },
  drags: { key: 'd', size: 4, steps: DRAG_STEPS },
  boosts: { key: 'b', size: 2, steps: 1 },
  weapons: { key: 'w', size: 2, steps: 1 },
} as const satisfies Record<
  keyof ReplayInputs,
  { key: string; size: number; steps: number }
>;

type Kind = keyof typeof KINDS;
const KIND_NAMES = Object.keys(KINDS) as Kind[];

function pack({ header, inputs }: Replay): Record<string, unknown> {
  const packed: Record<string, unknown> = { h: header };
  for (const kind of KIND_NAMES) {
    // A plain run packs as it did before the weapons.
    if (kind === 'weapons' && inputs[kind].length === 0) {
      continue;
    }
    packed[KINDS[kind].key] = flatten(inputs[kind], KINDS[kind].steps);
  }
  return packed;
}

/**
 * The packed run back as a replay to parse - throws where it is no run. A
 * link from before the weapons has no list of them, and none were fired.
 */
function unpack(packed: Record<string, unknown>): unknown {
  const inputs: Record<string, unknown[][]> = {};
  for (const kind of KIND_NAMES) {
    const { key, size, steps } = KINDS[kind];
    const list = kind === 'weapons' ? (packed[key] ?? []) : packed[key];
    inputs[kind] = unflatten(list, size, steps);
  }
  return { header: packed['h'], inputs };
}

/** `[tick, seat, ...values]` entries as one list of whole numbers. */
function flatten(
  entries: readonly (readonly number[])[],
  steps: number
): number[] {
  const flat: number[] = [];
  let tick = 0;
  for (const [at, seat, ...values] of entries) {
    flat.push(at - tick, seat, ...values.map((v) => Math.round(v * steps)));
    tick = at;
  }
  return flat;
}

function unflatten(flat: unknown, size: number, steps: number): unknown[][] {
  if (!Array.isArray(flat) || flat.length % size !== 0) {
    throw new Error('No list of inputs');
  }
  const entries: unknown[][] = [];
  let tick = 0;
  for (let i = 0; i < flat.length; i += size) {
    const [delta, seat, ...values] = flat.slice(i, i + size) as number[];
    tick += delta;
    entries.push([tick, seat, ...values.map((v) => v / steps)]);
  }
  return entries;
}

/** The bytes through a compression or decompression stream. */
async function transform(
  bytes: Uint8Array<ArrayBuffer>,
  stream: CompressionStream | DecompressionStream,
  maxBytes = Infinity
): Promise<Uint8Array<ArrayBuffer>> {
  const writer = stream.writable.getWriter();
  // Not awaited: the stream only takes more once its output is read.
  writer.write(bytes).catch(() => undefined);
  writer.close().catch(() => undefined);
  const reader = stream.readable.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }
    length += value.length;
    if (length > maxBytes) {
      await reader.cancel();
      throw new Error('The run is too big');
    }
    chunks.push(value);
  }
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array<ArrayBuffer> {
  const binary = atob(text.replaceAll('-', '+').replaceAll('_', '/'));
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}
