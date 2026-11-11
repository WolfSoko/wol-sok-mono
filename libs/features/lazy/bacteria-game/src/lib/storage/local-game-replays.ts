import { map, Observable, of } from 'rxjs';
import {
  type CommandResult,
  dailyLevelId,
  fromBase64,
  isObject,
  MAX_PACKED_BYTES,
  type ReplayCommandType,
  type ReplayKind,
  replayFromBytes,
  replayToBytes,
  type StoredPlayback,
  storedPlaybackOf,
  toBase64,
  utcDay,
} from '@wolsok/feat-shared-bacteria-engine';
import type { GameReplays } from './game-replays';
import type { GameStorage } from './game-storage';
import {
  hintOf,
  MAX_REPLAY_LIST,
  onlineIdOf,
  ReplayListing,
  ReplaySubmission,
} from './replay-records';

export const LOCAL_REPLAYS_KEY = 'bacteria-game.replays';
/** The most replays this device keeps - the newest ones. */
export const MAX_LOCAL_REPLAYS = 20;
/**
 * The most the kept replays take, in characters of their encoded bytes:
 * local storage holds about 5 MB per site, which the rest of the game needs
 * too.
 */
export const MAX_LOCAL_REPLAY_CHARS = 1_000_000;

/**
 * A replay this device keeps: its listing and its bytes, base64. It keeps
 * no seat: without a project there are no online matches, and against the
 * computer the player is seat 0, which {@link parseLocalReplays} adds.
 */
export interface LocalReplay extends Omit<
  ReplayListing,
  'seat' | 'simulation'
> {
  /** Absent on an entry kept before the store wrote it. */
  simulation?: string;
  bytes: string;
}

/** A kept replay as read back, with its seat. */
export type KeptReplay = LocalReplay & Pick<ReplayListing, 'seat'>;

/**
 * What reading an old entry's bytes found: its playback, or `broken` for
 * bytes that are no base64 at all and so never will read. Bytes that do not
 * inflate or parse find nothing: that may be this runtime's fault, so the
 * entry stays as stored and is read again next time.
 */
export type ReadPlayback = StoredPlayback | 'broken';

/** What reading found, by id, for the entries kept before `simulation`. */
type ReadPlaybacks = ReadonlyMap<string, ReadPlayback>;

/**
 * The player's recorded matches without a project, or while the project
 * takes none yet: kept on this device, the newest {@link MAX_LOCAL_REPLAYS}
 * and at most {@link MAX_LOCAL_REPLAY_CHARS} of them, in the storage it is
 * given - this device's (`DeviceStorage`), so nothing of it reaches a
 * project. Nothing checks them; they are `submitted` for good.
 */
export class LocalGameReplays implements GameReplays {
  public readonly cloud = false;
  private readonly commands = new Map<string, CommandResult>();
  private nextId = 0;

  public constructor(private readonly storage: GameStorage) {}

  public async submit({
    replay,
    hint,
  }: ReplaySubmission): Promise<string | null> {
    const bytes = await replayToBytes(replay);
    if (bytes.length > MAX_PACKED_BYTES) {
      return null;
    }
    const createdAt = Date.now();
    const id =
      onlineIdOf(replay) ?? `l_${createdAt.toString(36)}${this.nextId++}`;
    const { header } = replay;
    const entry: LocalReplay = {
      id,
      kind: kindOf(header.levelId, header.roomCode !== undefined, createdAt),
      levelId: header.levelId,
      ...storedPlaybackOf(header),
      createdAt,
      ticks: header.ticks,
      endedBy: header.outcome?.endedBy ?? 'annihilation',
      winnerSeat: header.outcome?.winnerSeat ?? null,
      hint: hintOf(hint),
      state: 'submitted',
      bytes: toBase64(bytes),
    };
    void this.storage.update(LOCAL_REPLAYS_KEY, (stored) =>
      capped([
        entry,
        ...parseLocalReplays(stored).filter((kept) => kept.id !== id),
      ])
    );
    return id;
  }

  public watchSaved(id: string): Observable<boolean> {
    return this.storage
      .watch(LOCAL_REPLAYS_KEY)
      .pipe(
        map((stored) =>
          parseLocalReplays(stored).some((kept) => kept.id === id)
        )
      );
  }

  public async listMine(limit = MAX_REPLAY_LIST): Promise<ReplayListing[]> {
    return (await this.read()).slice(0, Math.max(0, limit));
  }

  public async replayBytes(
    id: string
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const kept = (await this.readStored()).find((replay) => replay.id === id);
    return kept === undefined ? null : fromBase64(kept.bytes);
  }

  public async sendCommand(
    type: ReplayCommandType,
    replayId: string
  ): Promise<string | null> {
    const id = `c_${this.nextId++}`;
    // Nothing here reaches a gallery: both delete the match.
    if (type === 'remove' || type === 'forget') {
      void this.storage.update(LOCAL_REPLAYS_KEY, (stored) =>
        parseLocalReplays(stored).filter((kept) => kept.id !== replayId)
      );
      this.commands.set(id, { ok: true });
    } else {
      // Featuring and the like need the server.
      this.commands.set(id, { ok: false, error: 'no-cloud' });
    }
    return id;
  }

  public watchCommand(commandId: string): Observable<CommandResult | null> {
    return of(this.commands.get(commandId) ?? null);
  }

  /**
   * The kept replays' rows, once the storage answered. Entries kept before
   * the store wrote `simulation` take it (and `ladder`) from their bytes, and
   * the store writes it back, so each one is read once. One whose bytes are
   * broken is removed; one that did not read is left out of the list.
   */
  private async read(): Promise<ReplayListing[]> {
    const kept = await this.readStored();
    const read = await playbacksOf(
      kept.filter((replay) => replay.simulation === undefined)
    );
    if (read.size > 0) {
      void this.storage.update(LOCAL_REPLAYS_KEY, (stored) =>
        backfilled(stored, read)
      );
    }
    return kept.flatMap((replay) => listingOf(replay, read));
  }

  /** The kept replays as stored, once the storage answered. */
  private readStored(): Promise<KeptReplay[]> {
    return new Promise((resolve) => {
      const subscription = this.storage
        .watch(LOCAL_REPLAYS_KEY)
        .subscribe((stored) => {
          resolve(parseLocalReplays(stored));
          // Unsubscribed on the next turn: the first value may come at once.
          queueMicrotask(() => subscription.unsubscribe());
        });
    });
  }
}

/**
 * The kept replays as stored, newest first - the entries it can read, the
 * rest dropped.
 */
export function parseLocalReplays(stored: unknown): KeptReplay[] {
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored
    .filter(isLocalReplay)
    .map((replay) => ({ ...replay, seat: 0 }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function isLocalReplay(value: unknown): value is LocalReplay {
  return (
    isObject(value) &&
    typeof value['id'] === 'string' &&
    typeof value['bytes'] === 'string' &&
    typeof value['levelId'] === 'string' &&
    typeof value['createdAt'] === 'number' &&
    typeof value['ticks'] === 'number' &&
    typeof value['hint'] === 'number' &&
    typeof value['balanceVersion'] === 'number' &&
    typeof value['replayVersion'] === 'number' &&
    (value['simulation'] === undefined ||
      typeof value['simulation'] === 'string') &&
    (value['ladder'] === undefined || typeof value['ladder'] === 'number') &&
    typeof value['endedBy'] === 'string' &&
    (value['winnerSeat'] === null || typeof value['winnerSeat'] === 'number') &&
    typeof value['kind'] === 'string' &&
    value['state'] === 'submitted'
  );
}

/**
 * The stored entries with what reading their bytes found: the playback added
 * to each entry still lacking `simulation`, a `broken` one removed. Entries
 * not read, and ones that gained `simulation` meanwhile, stay as they are -
 * so this may run more than once, as `GameStorage.update` allows.
 */
export function backfilled(stored: unknown, read: ReadPlaybacks): unknown {
  if (!Array.isArray(stored)) {
    return stored;
  }
  return stored.flatMap((entry: unknown) => {
    if (
      !isObject(entry) ||
      entry['simulation'] !== undefined ||
      typeof entry['id'] !== 'string'
    ) {
      return [entry];
    }
    const found = read.get(entry['id']);
    if (found === undefined) {
      return [entry];
    }
    return found === 'broken' ? [] : [{ ...entry, ...found }];
  });
}

/** A kept replay's row with what reading found - none while it has none. */
function listingOf(
  { bytes: _bytes, simulation, ...listing }: KeptReplay,
  read: ReadPlaybacks
): ReplayListing[] {
  if (simulation !== undefined) {
    return [{ ...listing, simulation }];
  }
  const found = read.get(listing.id);
  return found === undefined || found === 'broken'
    ? []
    : [{ ...listing, ...found }];
}

/** What the bytes of the given replays hold, for those where it is known. */
async function playbacksOf(replays: LocalReplay[]): Promise<ReadPlaybacks> {
  const read = await Promise.all(
    replays.map(async ({ id, bytes }) => [id, await playbackOf(bytes)] as const)
  );
  return new Map(
    read.filter((entry): entry is [string, ReadPlayback] => entry[1] !== null)
  );
}

/** What a kept replay's bytes hold, null when that is not known. */
async function playbackOf(bytes: string): Promise<ReadPlayback | null> {
  const packed = fromBase64(bytes);
  if (packed === null) {
    return 'broken';
  }
  const replay = await replayFromBytes(packed);
  return replay === null ? null : storedPlaybackOf(replay.header);
}

/** The newest replays that fit the caps. */
function capped(replays: LocalReplay[]): LocalReplay[] {
  const kept: LocalReplay[] = [];
  let chars = 0;
  for (const replay of replays) {
    if (kept.length >= MAX_LOCAL_REPLAYS) {
      break;
    }
    chars += replay.bytes.length;
    if (chars > MAX_LOCAL_REPLAY_CHARS) {
      break;
    }
    kept.push(replay);
  }
  return kept;
}

/** The kind as the server would derive it, as far as this device can tell. */
function kindOf(levelId: string, online: boolean, at: number): ReplayKind {
  if (online) {
    return 'online';
  }
  return levelId === dailyLevelId(utcDay(new Date(at))) ? 'daily' : 'computer';
}
