import { Firestore, Timestamp, Transaction } from 'firebase-admin/firestore';
import type { OnlineReason } from '@wolsok/feat-lazy-bac-game/engine';
import type { AccountLookup } from '../accounts';
import type { Engine } from '../engine';
import type { ReplayDoc } from '../replays/model';
import { seatUids } from '../replays/publish';
import { DAY_MS, dayOf, HOUR_MS } from '../time';
import {
  banActive,
  entryRef,
  memberOf,
  memberRef,
  putEntry,
  readStanding,
  Standing,
} from './entries';
import type { MemberDoc, OnlineRecord } from './model';

/** Days a ranking marker is kept (TTL). */
export const MARKER_DAYS = 31;

/** What counting an agreed online match did. */
export type OnlineCount =
  | { counted: { winner: boolean; loser: boolean; draw: boolean } }
  | { reason: OnlineReason }
  | { done: true };

/**
 * Counts an `agreed` online match on the online board (ADR 0012), in one
 * transaction with its caps: the room stub named both players, the match
 * lasted 30 s, the reports came no faster than the room's clock allows,
 * nobody in it is banned, at most 3 counted results per pair a day, at
 * most 30 counted wins a day and 5 against accounts younger than 3 days.
 * Losses count whenever the pair cap allows. A marker
 * `rankedReplays/{replayId}` makes a second event change nothing.
 */
export async function countOnline(
  db: Firestore,
  engine: Engine,
  accounts: AccountLookup,
  replayId: string,
  doc: ReplayDoc,
  now = Date.now()
): Promise<OnlineCount> {
  const caps = engine.ONLINE_CAPS;
  const replayRef = db.doc(`replays/${replayId}`);
  const seats = seatUids(doc);
  const early: OnlineReason | null =
    doc.endedBy === 'desync'
      ? 'desync'
      : doc.bound !== true || seats === null || doc.room?.createdAt == null
        ? 'unbound'
        : doc.ticks < caps.minTicks
          ? 'short'
          : null;
  if (early !== null || seats === null) {
    await replayRef.update({ rankedReason: early ?? 'unbound' });
    return { reason: early ?? 'unbound' };
  }
  const [host, guest] = seats as [string, string];
  const found = await accounts([host, guest]);
  const reports = await db.getAll(
    db.doc(`replays/${replayId}/reports/${host}`),
    db.doc(`replays/${replayId}/reports/${guest}`)
  );
  const secondAt = Math.max(
    ...reports.map(
      (report) => (report.get('at') as Timestamp | undefined)?.toMillis() ?? now
    )
  );
  const room = doc.room as NonNullable<ReplayDoc['room']>;
  const stubCreatedAt = (room.createdAt as Timestamp).toMillis();
  const day = dayOf(now);
  const [a, b] = [host, guest].sort();

  return db.runTransaction(async (tx): Promise<OnlineCount> => {
    const markerRef = db.doc(`rankedReplays/${replayId}`);
    const roomRef = db.doc(`rankedRooms/${room.code}`);
    const pairRef = db.doc(`pairs/${day}_${a}_${b}`);
    const [marker, roomDoc, pair, hostBan, guestBan] = await tx.getAll(
      markerRef,
      roomRef,
      pairRef,
      db.doc(`bans/${host}`),
      db.doc(`bans/${guest}`)
    );
    if (marker.exists) {
      return { done: true };
    }
    const members = await tx.getAll(memberRef(db, host), memberRef(db, guest));
    const [hostMember, guestMember] = members.map((snapshot) =>
      memberOf(snapshot)
    );
    const standings = [
      await readStanding(tx, db, host, now),
      await readStanding(tx, db, guest, now),
    ];
    const finish = (result: OnlineCount): OnlineCount => {
      tx.create(markerRef, {
        at: Timestamp.fromMillis(now),
        expireAt: Timestamp.fromMillis(now + MARKER_DAYS * DAY_MS),
      });
      tx.update(
        replayRef,
        'reason' in result
          ? { rankedReason: result.reason }
          : { rankedAt: Timestamp.fromMillis(now) }
      );
      return result;
    };

    // The room's clock: a reused code starts over with its new stub.
    const sameRoom =
      (roomDoc.get('stubCreatedAt') as Timestamp | undefined)?.toMillis() ===
      stubCreatedAt;
    const summed =
      (sameRoom ? ((roomDoc.get('ticks') as number | undefined) ?? 0) : 0) +
      doc.ticks;
    tx.set(roomRef, {
      stubCreatedAt: Timestamp.fromMillis(stubCreatedAt),
      ticks: summed,
      // Six hours after the stub's own end, at most six after it opened.
      expireAt: Timestamp.fromMillis(stubCreatedAt + 12 * HOUR_MS),
    });
    if (banActive(hostBan, now) || banActive(guestBan, now)) {
      return finish({ reason: 'banned' });
    }
    const earliest =
      stubCreatedAt +
      (summed / engine.TICKS_PER_SEC) * 1000 -
      caps.roomClockSlackMs;
    if (secondAt < earliest) {
      return finish({ reason: 'too-fast' });
    }
    const pairCount = (pair.get('count') as number | undefined) ?? 0;
    if (pairCount >= caps.perPairDay) {
      return finish({ reason: 'capped' });
    }
    tx.set(pairRef, {
      count: pairCount + 1,
      expireAt: Timestamp.fromMillis(now + 2 * DAY_MS),
    });

    const sides = [
      { uid: host, member: hostMember, standing: standings[0] },
      { uid: guest, member: guestMember, standing: standings[1] },
    ];
    const draw = doc.winnerSeat === null;
    const counted = { winner: false, loser: false, draw };
    sides.forEach((side, seat) => {
      if (side.member.barred.includes('online')) {
        return;
      }
      const record: OnlineRecord = {
        w: 0,
        l: 0,
        d: 0,
        nr: 0,
        ...side.member.record,
      };
      if (draw) {
        record.d++;
      } else if (seat === doc.winnerSeat) {
        const opponent = found.get(sides[1 - seat].uid);
        const young =
          opponent === undefined ||
          now - opponent.createdAt < caps.newOpponentDays * DAY_MS;
        if (!takeWin(side.member, day, young, caps)) {
          return;
        }
        record.w++;
        counted.winner = true;
      } else {
        record.l++;
        counted.loser = true;
      }
      side.member.record = record;
      putOnlineEntry(tx, db, engine, side.member, side.standing, now);
      tx.set(memberRef(db, side.uid), side.member);
    });
    return finish({ counted });
  });
}

/** Takes one of the day's counted wins - false when a cap is reached. */
function takeWin(
  member: MemberDoc,
  day: string,
  young: boolean,
  caps: Engine['ONLINE_CAPS']
): boolean {
  const today =
    member.online?.day === day
      ? member.online
      : { day, wins: 0, newOpponentWins: 0 };
  if (
    today.wins >= caps.winsDay ||
    (young && today.newOpponentWins >= caps.newOpponentWinsDay)
  ) {
    return false;
  }
  member.online = {
    day,
    wins: today.wins + 1,
    newOpponentWins: today.newOpponentWins + (young ? 1 : 0),
  };
  return true;
}

/** Writes the player's online entry from their record. */
export function putOnlineEntry(
  tx: Transaction,
  db: Firestore,
  engine: Engine,
  member: MemberDoc,
  standing: Standing,
  now: number,
  atHour = engine.atHourOf(now)
): void {
  const record = member.record ?? { w: 0, l: 0, d: 0, nr: 0 };
  putEntry(tx, db, engine, {
    boardId: 'online',
    member,
    standing,
    score: {
      sort: engine.onlineSort(record.w, record.l),
      atHour,
      baseStatus: 'counted',
      show: { ...record },
    },
    now,
  });
}

/**
 * "Not reported" (ADR 0012): an online replay still `waiting` two hours
 * after it was created, whose one report ended regularly - a win, the
 * clock, or a forfeit after 30 s - counts one against the player the stub
 * names who did not report. Their entry shows it, `sort` does not. Run by
 * the hourly function; the ranking marker makes it count once.
 */
export async function closeWaiting(
  db: Firestore,
  engine: Engine,
  replayId: string,
  doc: ReplayDoc,
  now = Date.now()
): Promise<string | null> {
  const seats = [doc.room?.host ?? null, doc.room?.guest ?? null];
  const missing = seats.find(
    (uid): uid is string => uid !== null && !doc.players.includes(uid)
  );
  const regular =
    doc.endedBy !== 'desync' &&
    (doc.endedBy !== 'forfeit' || doc.ticks >= engine.ONLINE_CAPS.minTicks);
  return db.runTransaction(async (tx) => {
    const markerRef = db.doc(`rankedReplays/${replayId}`);
    const marker = await tx.get(markerRef);
    if (marker.exists) {
      return null;
    }
    const counts =
      doc.bound === true && regular && missing !== undefined ? missing : null;
    let member: MemberDoc | null = null;
    let standing: Standing | null = null;
    let atHour: number | null = null;
    if (counts !== null) {
      member = memberOf(await tx.get(memberRef(db, counts)));
      const entry = await tx.get(
        entryRef(db, 'online', member.entryIds.online)
      );
      atHour = entry.exists ? (entry.get('atHour') as number) : null;
      standing = await readStanding(tx, db, counts, now);
    }
    tx.create(markerRef, {
      at: Timestamp.fromMillis(now),
      notReported: counts !== null,
      expireAt: Timestamp.fromMillis(now + MARKER_DAYS * DAY_MS),
    });
    if (counts === null || member === null || standing === null) {
      return null;
    }
    member.record = {
      w: 0,
      l: 0,
      d: 0,
      nr: 0,
      ...member.record,
    };
    member.record.nr++;
    if (atHour !== null) {
      putOnlineEntry(tx, db, engine, member, standing, now, atHour);
    }
    tx.set(memberRef(db, counts), member);
    return counts;
  });
}
