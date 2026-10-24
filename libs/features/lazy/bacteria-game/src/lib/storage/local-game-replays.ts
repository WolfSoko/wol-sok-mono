import { map, Observable, of } from 'rxjs';
import { dailyLevelId, utcDay } from '../state/daily';
import { isObject } from '../state/is-object';
import { MAX_PACKED_BYTES, replayToBytes } from '../state/replay-pack';
import type { GameReplays } from './game-replays';
import type { GameStorage } from './game-storage';
import {
  hintOf,
  MAX_REPLAY_LIST,
  onlineIdOf,
  ReplayCommandResult,
  ReplayCommandType,
  ReplayKind,
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

/** A replay this device keeps: its listing and its bytes, base64. */
export interface LocalReplay extends ReplayListing {
  bytes: string;
}

/**
 * The player's recorded matches without a project, or while the project
 * takes none yet: kept on this device, the newest {@link MAX_LOCAL_REPLAYS}
 * and at most {@link MAX_LOCAL_REPLAY_CHARS} of them, in the storage it is
 * given - this device's (`DeviceStorage`), so nothing of it reaches a
 * project. Nothing checks them; they are `submitted` for good.
 */
export class LocalGameReplays implements GameReplays {
  private readonly commands = new Map<string, ReplayCommandResult>();
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
      balanceVersion: header.balanceVersion,
      replayVersion: header.version,
      createdAt,
      ticks: header.ticks,
      endedBy: header.outcome?.endedBy ?? 'annihilation',
      winnerSeat: header.outcome?.winnerSeat ?? null,
      hint: hintOf(hint),
      state: 'submitted',
      bytes: toBase64(bytes),
    };
    this.storage.update(LOCAL_REPLAYS_KEY, (stored) =>
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

  public listMine(limit = MAX_REPLAY_LIST): Promise<ReplayListing[]> {
    return this.read().then((replays) =>
      replays
        .slice(0, Math.max(0, limit))
        .map(({ bytes: _bytes, ...listing }) => listing)
    );
  }

  public async replayBytes(
    id: string
  ): Promise<Uint8Array<ArrayBuffer> | null> {
    const kept = (await this.read()).find((replay) => replay.id === id);
    return kept === undefined ? null : fromBase64(kept.bytes);
  }

  public async sendCommand(
    type: ReplayCommandType,
    replayId: string
  ): Promise<string | null> {
    const id = `c_${this.nextId++}`;
    if (type === 'remove') {
      this.storage.update(LOCAL_REPLAYS_KEY, (stored) =>
        parseLocalReplays(stored).filter((kept) => kept.id !== replayId)
      );
      this.commands.set(id, { ok: true });
    } else {
      // Featuring and the like need the server.
      this.commands.set(id, { ok: false, reason: 'no-cloud' });
    }
    return id;
  }

  public watchCommand(
    commandId: string
  ): Observable<ReplayCommandResult | null> {
    return of(this.commands.get(commandId) ?? null);
  }

  /** The kept replays, once the storage answered. */
  private read(): Promise<LocalReplay[]> {
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
export function parseLocalReplays(stored: unknown): LocalReplay[] {
  if (!Array.isArray(stored)) {
    return [];
  }
  return stored.filter(isLocalReplay).sort((a, b) => b.createdAt - a.createdAt);
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
    typeof value['endedBy'] === 'string' &&
    (value['winnerSeat'] === null || typeof value['winnerSeat'] === 'number') &&
    typeof value['kind'] === 'string' &&
    value['state'] === 'submitted'
  );
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

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array<ArrayBuffer> | null {
  try {
    const binary = atob(text);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  } catch {
    return null;
  }
}
