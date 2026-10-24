import { DRAG_STEPS, STEER_STEPS } from './match-engine';
import { ParseOptions, parseReplay, Replay, ReplayInputs } from './replay';

/**
 * The most a stored replay may take, deflated: what `replaySubmissions`
 * accepts (ADR 0011). An hour of both sticks moving every tick comes to
 * about 550 KB.
 */
export const MAX_PACKED_BYTES = 600_000;

/**
 * The most a replay may grow to once inflated. An hour of both sticks
 * moving every tick comes to about 5 MB; bytes that inflate to more are no
 * replay, but a way to fill the memory.
 */
export const MAX_UNPACKED_BYTES = 8 * 1024 * 1024;

/** How to pack a replay. */
export interface PackOptions {
  /**
   * True for a replay anyone may see - a `#ghost=` link, a public replay:
   * without the room, the match number and the app version.
   */
  forPublic?: boolean;
}

/**
 * A replay packed for a link or for storage: the header as it is, each kind
 * of input as one flat list of whole numbers. The weapons fired only a
 * replay with evolution in it has (version 3, ADR 0013); a plain one packs
 * as it did before them.
 */
export interface PackedReplay {
  h: Replay['header'];
  s: number[];
  d: number[];
  b: number[];
  w?: number[];
}

/**
 * How each kind of input is packed: the key it goes under, the numbers of
 * an entry and the grid its values lie on. The values are written as whole
 * numbers on that grid, each tick as the ticks since the input before -
 * small numbers that pack well. An `optional` kind is left out while it is
 * empty, as a replay from before it has none.
 */
const KINDS = {
  steers: { key: 's', size: 4, steps: STEER_STEPS, optional: false },
  drags: { key: 'd', size: 4, steps: DRAG_STEPS, optional: false },
  boosts: { key: 'b', size: 2, steps: 1, optional: false },
  weapons: { key: 'w', size: 2, steps: 1, optional: true },
} as const satisfies Record<
  keyof ReplayInputs,
  {
    key: Exclude<keyof PackedReplay, 'h'>;
    size: number;
    steps: number;
    optional: boolean;
  }
>;

type Kind = keyof typeof KINDS;
const KIND_NAMES = Object.keys(KINDS) as Kind[];

/** The replay packed as JSON-plain data - lossless for inputs on their grids. */
export function packReplay(
  { header, inputs }: Replay,
  options: PackOptions = {}
): PackedReplay {
  let h = header;
  if (options.forPublic === true) {
    const { roomCode: _room, n: _n, client: _client, ...rest } = header;
    h = rest;
  }
  const packed: Partial<PackedReplay> = { h };
  for (const kind of KIND_NAMES) {
    const { key, steps, optional } = KINDS[kind];
    if (!optional || inputs[kind].length > 0) {
      packed[key] = flatten(inputs[kind], steps);
    }
  }
  return packed as PackedReplay;
}

/** The packed replay back, parsed - null for anything that is not a whole one. */
export function unpackReplay(
  packed: unknown,
  options: ParseOptions = {}
): Replay | null {
  if (typeof packed !== 'object' || packed == null) {
    return null;
  }
  const fields = packed as Record<string, unknown>;
  const inputs: Record<string, unknown[][]> = {};
  for (const kind of KIND_NAMES) {
    const { key, size, steps, optional } = KINDS[kind];
    const flat = optional ? (fields[key] ?? []) : fields[key];
    const entries = unflatten(flat, size, steps);
    if (entries === null) {
      return null;
    }
    inputs[kind] = entries;
  }
  return parseReplay({ header: fields['h'], inputs }, options);
}

/** The replay as stored: deflate-raw of its packed JSON. */
export async function replayToBytes(
  replay: Replay,
  options: PackOptions = {}
): Promise<Uint8Array<ArrayBuffer>> {
  const json = new TextEncoder().encode(
    JSON.stringify(packReplay(replay, options))
  );
  return transform(json, new CompressionStream('deflate-raw'));
}

/**
 * The replay stored in these bytes - null for bytes over the caps, or for
 * anything that is not a whole replay.
 */
export async function replayFromBytes(
  bytes: Uint8Array<ArrayBuffer>,
  options: ParseOptions = {}
): Promise<Replay | null> {
  if (bytes.length > MAX_PACKED_BYTES) {
    return null;
  }
  try {
    const json = await transform(
      bytes,
      new DecompressionStream('deflate-raw'),
      MAX_UNPACKED_BYTES
    );
    return unpackReplay(JSON.parse(new TextDecoder().decode(json)), options);
  } catch {
    return null;
  }
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
  flat: unknown,
  size: number,
  steps: number
): unknown[][] | null {
  if (!Array.isArray(flat) || flat.length % size !== 0) {
    return null;
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
      throw new Error('The replay is too big');
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
