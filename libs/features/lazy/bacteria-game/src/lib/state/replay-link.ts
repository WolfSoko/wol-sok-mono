import { DRAG_STEPS, STEER_STEPS } from './match-engine';
import { parseReplay, Replay, ReplayInputs, REPLAY_VERSION } from './replay';

/** The key of a run in the hash of a link: `#ghost=...`. */
const HASH_KEY = 'ghost';

/**
 * The most a run may grow to once unpacked. An hour of play is far below it;
 * a link that unpacks to more is no run, but a way to fill the memory.
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
 * that is damaged or from another version of the game.
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
    return replay?.header.version === REPLAY_VERSION ? replay : null;
  } catch {
    return null;
  }
}

/**
 * A run as a link carries it: the inputs as whole numbers on the engine's
 * grid, each tick told as the ticks since the input before - small numbers
 * that pack well.
 */
interface PackedReplay {
  h: Replay['header'];
  s: number[];
  d: number[];
  b: number[];
}

function pack({ header, inputs }: Replay): PackedReplay {
  return {
    h: header,
    s: flatten(inputs.steers, STEER_STEPS),
    d: flatten(inputs.drags, DRAG_STEPS),
    b: flatten(inputs.boosts, 1),
  };
}

/** The packed run as a replay to parse - anything else comes back as it is. */
function unpack(value: unknown): unknown {
  if (typeof value !== 'object' || value == null) {
    return value;
  }
  const { h, s, d, b } = value as Partial<PackedReplay>;
  if (!Array.isArray(s) || !Array.isArray(d) || !Array.isArray(b)) {
    return null;
  }
  const inputs: ReplayInputs = {
    steers: unflatten(s, 4, STEER_STEPS) as ReplayInputs['steers'],
    drags: unflatten(d, 4, DRAG_STEPS) as ReplayInputs['drags'],
    boosts: unflatten(b, 2, 1) as ReplayInputs['boosts'],
  };
  return { header: h, inputs };
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

function unflatten(
  flat: readonly unknown[],
  size: number,
  steps: number
): unknown[][] {
  const entries: unknown[][] = [];
  let tick = 0;
  for (let i = 0; i + size <= flat.length; i += size) {
    const [delta, seat, ...values] = flat.slice(i, i + size) as number[];
    tick += delta;
    entries.push([tick, seat, ...values.map((v) => v / steps)]);
  }
  // A list cut short is no list of inputs: parseReplay refuses the rest.
  return flat.length % size === 0 ? entries : [[NaN]];
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
