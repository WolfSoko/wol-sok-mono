import { atHourOf, onlineSort } from '@wolsok/feat-lazy-bac-game/engine';
import {
  FieldValue,
  type Firestore,
  Timestamp,
} from 'firebase-admin/firestore';
import { dayOf, isBanned } from '../limits';
import { entryData, hiddenFor, memberIn, profileIn } from './entries';

/** A match shorter than this counts nothing: 30 s at 60 ticks a second. */
export const MIN_COUNTED_TICKS = 1_800;
/** Counted results per pair of players and UTC day. */
export const PAIR_RESULTS_PER_DAY = 3;
/** Counted wins per player and UTC day. */
export const WINS_PER_DAY = 30;
/** Counted wins a day against accounts younger than {@link NEW_ACCOUNT_MS}. */
export const NEW_OPPONENT_WINS_PER_DAY = 5;
export const NEW_ACCOUNT_MS = 3 * 24 * 3_600_000;
/** What the room's clock forgives when the second report arrives. */
const ROOM_SLACK_MS = 60_000;
const DAY_MS = 24 * 3_600_000;

/** When an account was made, in ms - null when unknown. */
export type AccountCreatedAt = (uid: string) => Promise<number | null>;

/** Why an agreed online match did (not) count - on the replay as `rankedReason`. */
export type OnlineReason =
  | 'counted'
  | 'desync'
  | 'short'
  | 'stub-expired'
  | 'banned'
  | 'too-fast'
  | 'pair-cap';

/** One player's online record, as their entry shows it. */
interface Record4 {
  w: number;
  l: number;
  d: number;
  nr: number;
}

/**
 * Counts an online match on the `online` board once it turns `agreed`
 * (ADR 0012). Both devices reported the same match in a room whose stub
 * names both players; this checks that it ran long enough, no faster than
 * its room's clock allows, with nobody banned, and within the caps:
 * 3 results per pair a day, 30 counted wins a day, 5 of them against
 * accounts younger than 3 days. Losses count whenever the pair cap allows.
 * A marker per replay keeps a second event from counting it twice. The
 * match is read in the transaction, never taken from an event: a match
 * without a uid in both seats - its shape is off, or a player deleted
 * their account since (their seat nulled) - counts nothing, as
 * `stub-expired`.
 */
export async function rankOnline(
  db: Firestore,
  replayId: string,
  accountCreatedAt: AccountCreatedAt,
  now: number = Date.now()
): Promise<OnlineReason | 'done'> {
  const day = dayOf(now);
  const marker = db.doc(`rankedReplays/${replayId}`);
  const replayRef = db.doc(`replays/${replayId}`);
  return db.runTransaction(async (tx) => {
    const [ranked, stored] = await tx.getAll(marker, replayRef);
    if (ranked.exists || !stored.exists) {
      return 'done' as const;
    }
    /** Marks the match answered - after the transaction's last read. */
    const answer = <R extends OnlineReason>(decided: R): R => {
      tx.create(marker, {
        at: FieldValue.serverTimestamp(),
        expireAt: Timestamp.fromMillis(now + 31 * DAY_MS),
      });
      tx.update(replayRef, {
        rankedReason: decided,
        rankedAt: FieldValue.serverTimestamp(),
      });
      return decided;
    };
    const replay = stored.data() ?? {};
    const seats = replay['seats'];
    if (
      !Array.isArray(seats) ||
      seats.length !== 2 ||
      !seats.every((uid) => typeof uid === 'string')
    ) {
      return answer('stub-expired');
    }
    const uids = seats as [string, string];
    const [host, guest] = uids;
    const ticks = Number(replay['ticks']);
    const winnerSeat = replay['winnerSeat'];
    const reason = await precheck(db, replay, host, guest, ticks, now);
    if (reason !== 'counted') {
      return answer(reason);
    }
    const roomRef = db.doc(`rankedRooms/${String(replay['room'])}`);
    const pairRef = db.doc(`pairs/${day}_${[host, guest].sort().join('_')}`);
    const [room, pairDoc] = await tx.getAll(roomRef, pairRef);
    const members = [
      await memberIn(tx, db, host),
      await memberIn(tx, db, guest),
    ];
    const profiles = [
      await profileIn(tx, db, host),
      await profileIn(tx, db, guest),
    ];
    const entryRefs = members.map((member) =>
      db.doc(`boards/online/entries/${member.entryIds.online}`)
    );
    const entries = [await tx.get(entryRefs[0]), await tx.get(entryRefs[1])];

    // Rooms cannot run matches side by side faster than real time.
    const stubCreatedAt =
      replay['stubCreatedAt'] instanceof Timestamp
        ? replay['stubCreatedAt'].toMillis()
        : null;
    const sameRoom = room.exists && room.get('stubCreatedAt') === stubCreatedAt;
    const roomTicks = (sameRoom ? Number(room.get('ticks') ?? 0) : 0) + ticks;
    if (
      stubCreatedAt === null ||
      now < stubCreatedAt + (roomTicks / 60) * 1000 - ROOM_SLACK_MS
    ) {
      return answer('too-fast');
    }
    if (Number(pairDoc.get('count') ?? 0) >= PAIR_RESULTS_PER_DAY) {
      return answer('pair-cap');
    }
    // Only the winner's count asks how old the other account is.
    const loserAge =
      winnerSeat === 0 || winnerSeat === 1
        ? await accountCreatedAt(uids[1 - winnerSeat])
        : null;
    answer('counted');
    tx.set(roomRef, {
      stubCreatedAt,
      ticks: roomTicks,
      expireAt: Timestamp.fromMillis(stubCreatedAt + 12 * 3_600_000),
    });
    tx.set(pairRef, {
      count: Number(pairDoc.get('count') ?? 0) + 1,
      expireAt: Timestamp.fromMillis(now + 2 * DAY_MS),
    });
    [0, 1].forEach((seat) => {
      const member = members[seat];
      const other = 1 - seat;
      const daily = dailyWins(member.data['online'], day);
      const record = recordOf(entries[seat].get('show'));
      let counts = daily;
      if (winnerSeat === seat) {
        const newOpponent =
          loserAge !== null && now - loserAge < NEW_ACCOUNT_MS;
        if (
          daily.wins < WINS_PER_DAY &&
          (!newOpponent || daily.newOpponentWins < NEW_OPPONENT_WINS_PER_DAY)
        ) {
          record.w++;
          counts = {
            day,
            wins: daily.wins + 1,
            newOpponentWins: daily.newOpponentWins + (newOpponent ? 1 : 0),
          };
        }
      } else if (winnerSeat === other) {
        record.l++;
      } else {
        record.d++;
      }
      tx.set(
        db.doc(`boardMembers/${uids[seat]}`),
        {
          entryIds: member.entryIds,
          boards: FieldValue.arrayUnion('online'),
          online: counts,
        },
        { merge: true }
      );
      tx.set(
        entryRefs[seat],
        entryData(
          member.entryIds.online,
          {
            sort: onlineSort(record.w, record.l),
            atHour: atHourOf(now),
            baseStatus: 'counted',
            show: record,
          },
          profiles[seat],
          hiddenFor(member.data, 'online', entries[seat].get('hiddenBy'))
        )
      );
    });
    return 'counted' as const;
  });
}

/** What rules a match out before any count: its end, its length, a ban. */
async function precheck(
  db: Firestore,
  replay: Record<string, unknown>,
  host: string,
  guest: string,
  ticks: number,
  now: number
): Promise<OnlineReason> {
  if (replay['endedBy'] === 'desync') {
    return 'desync';
  }
  if (!(ticks >= MIN_COUNTED_TICKS)) {
    return 'short';
  }
  if (replay['stubExpired'] === true) {
    return 'stub-expired';
  }
  const banned = await Promise.all([
    isBanned(db, host, now),
    isBanned(db, guest, now),
  ]);
  return banned.some(Boolean) ? 'banned' : 'counted';
}

/** The day's counted wins of a player, fresh for another day. */
function dailyWins(
  value: unknown,
  day: string
): { day: string; wins: number; newOpponentWins: number } {
  const v = (value ?? {}) as Record<string, unknown>;
  return v['day'] === day
    ? {
        day,
        wins: Number(v['wins'] ?? 0),
        newOpponentWins: Number(v['newOpponentWins'] ?? 0),
      }
    : { day, wins: 0, newOpponentWins: 0 };
}

function recordOf(value: unknown): Record4 {
  const v = (value ?? {}) as Record<string, unknown>;
  const n = (key: string) => {
    const x = Number(v[key] ?? 0);
    return Number.isSafeInteger(x) && x >= 0 ? x : 0;
  };
  return { w: n('w'), l: n('l'), d: n('d'), nr: n('nr') };
}
