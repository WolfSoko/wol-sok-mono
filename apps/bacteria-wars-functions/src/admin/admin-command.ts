import { createHash } from 'node:crypto';
import { Firestore, Timestamp } from 'firebase-admin/firestore';
import type { Auth } from 'firebase-admin/auth';
import type {
  AdminCommand,
  AdminCommandResult,
  BoardKind,
  EntryTarget,
} from '@wolsok/feat-lazy-bac-game/engine';
import { isAdminNow } from '../accounts';
import { kindOf, refreshEntries } from '../boards/entries';
import type { EndlessRunDoc, MemberDoc } from '../boards/model';
import {
  ADMIN_RUN_MINUTES,
  fixedPool,
  verifyDaily,
  verifyRun,
} from '../boards/verification';
import type { Engine } from '../engine';
import { minuteTicks } from '../replays/budgets';
import { banPlayer, Moderation, unbanPlayer } from './bans';
import { countModeration, notify, writeAudit } from './records';
import { recountAccounts, writeStats } from './stats';

/** What the owner's commands need. */
export interface AdminDeps extends Moderation {
  users: Pick<Auth, 'listUsers'>;
}

/** What an action did, for the result and the audit. */
interface Done {
  ok: boolean;
  error?: string;
  before?: unknown;
  after?: unknown;
  /** The player it acted on, for the audit's `target.uid`. */
  uid?: string;
}

/**
 * `adminCommand` (ADR 0012): acts on an `adminCommands` document. Checks
 * the admin first - the writer (`authId`) is the `uid` the command names,
 * and that user has the claim, a verified email and a Google provider,
 * read again from Auth - then runs the action, writes
 * `adminAudit/{commandId}` with `before` and `after`, and writes
 * `result: { ok, error?, at }` back on the command.
 *
 * Idempotent: a command with a result, or with its audit entry written
 * already, is not run again.
 */
export async function runAdminCommand(
  deps: AdminDeps,
  commandId: string,
  data: Record<string, unknown> | undefined,
  writer: string | undefined,
  now = Date.now()
): Promise<AdminCommandResult> {
  const { db, engine } = deps;
  const ref = db.doc(`adminCommands/${commandId}`);
  if (data === undefined || data['result'] !== undefined) {
    return { ok: false, error: 'done', at: now };
  }
  const audit = await db.doc(`adminAudit/${commandId}`).get();
  let done: Done;
  const command = engine.parseAdminCommand(data);
  // The parser checks the writer's `uid` when it is there; the command
  // counts only with it.
  const by = typeof data['uid'] === 'string' ? data['uid'] : null;
  if (audit.exists) {
    done = { ok: audit.get('ok') === true, error: 'done' };
  } else if (command === null || by === null) {
    done = { ok: false, error: 'invalid' };
  } else if (writer !== by) {
    done = { ok: false, error: 'not-writer' };
  } else if (!(await isAdminNow(deps.accounts, by))) {
    done = { ok: false, error: 'not-admin' };
  } else {
    try {
      done = await act(deps, command, now);
    } catch (error) {
      done = { ok: false, error: 'failed' };
      await ref.update({
        result: { ok: false, error: 'failed', at: now },
      });
      throw error;
    }
    await writeAudit(
      db,
      commandId,
      {
        by,
        type: command.type,
        target: {
          ...command.target,
          ...(done.uid === undefined ? {} : { uid: done.uid }),
        },
        reason: command.reason === '' ? null : command.reason,
        before: done.before ?? null,
        after: done.after ?? null,
        ok: done.ok,
        source: 'adminCommand',
      },
      now
    );
  }
  const result: AdminCommandResult = {
    ok: done.ok,
    ...(done.error === undefined ? {} : { error: done.error }),
    at: now,
  };
  await ref.update({ result });
  return result;
}

/** The player a target names: its uid, or the owner of a board entry. */
export async function targetUid(
  db: Firestore,
  engine: Engine,
  target: AdminCommand['target']
): Promise<string | null> {
  if (target === null) {
    return null;
  }
  if ('uid' in target) {
    return target.uid;
  }
  const kind = kindOf(engine, target.boardId);
  const found = await db
    .collection('boardMembers')
    .where(`entryIds.${kind}`, '==', target.entryId)
    .limit(1)
    .get();
  return found.docs[0]?.id ?? null;
}

async function act(
  deps: AdminDeps,
  command: AdminCommand,
  now: number
): Promise<Done> {
  const { db, engine } = deps;
  switch (command.type) {
    case 'stats.refresh':
      await writeStats(db, engine, deps.presence, now);
      return { ok: true };
    case 'stats.recount': {
      const before = (await db.doc('stats/accounts').get()).get('total');
      const total = await recountAccounts(db, deps.users, now);
      return { ok: true, before: { total: before ?? null }, after: { total } };
    }
    default:
      break;
  }
  const uid = await targetUid(db, engine, command.target);
  if (uid === null) {
    return { ok: false, error: 'no-player' };
  }
  const withUid = (done: Omit<Done, 'uid'>): Done => ({ ...done, uid });
  switch (command.type) {
    case 'profile.reset':
      return withUid(await resetProfile(deps, uid, now));
    case 'profile.removeImage':
      return withUid(await removeImage(deps, uid, now));
    case 'board.hideEntry':
    case 'board.hidePlayer':
      return withUid(await hide(deps, command, uid, now));
    case 'board.restore':
      return withUid(await restore(deps, command, uid, now));
    case 'board.verify':
      return withUid(await verifyNow(deps, command, uid, now));
    case 'player.ban': {
      const result = await banPlayer(
        deps,
        uid,
        command.args.until ?? null,
        command.args.reason ?? 'other',
        now
      );
      return withUid({ ok: true, before: result.before, after: result.after });
    }
    case 'player.unban': {
      const before = await unbanPlayer(deps, uid, now);
      return withUid(
        before === null
          ? { ok: false, error: 'not-banned' }
          : { ok: true, before, after: null }
      );
    }
  }
  return { ok: false, error: 'invalid' };
}

/** The board entry a target names - undefined for a player or none. */
function entryOf(target: AdminCommand['target']): EntryTarget | undefined {
  return target !== null && 'entryId' in target ? target : undefined;
}

/** What the audit keeps of a profile - never an uploaded image itself. */
function profileRecord(profile: Record<string, unknown> | undefined) {
  const avatar = profile?.['avatar'] as
    | { kind?: string; data?: string; url?: string; id?: number }
    | undefined;
  const image = avatar?.kind === 'image' ? (avatar.data ?? '') : null;
  return {
    name: profile?.['name'] ?? null,
    motto: profile?.['motto'] ?? null,
    avatarKind: avatar?.kind ?? null,
    ...(image === null
      ? {}
      : {
          imageSha256: createHash('sha256').update(image).digest('hex'),
          imageSize: image.length,
        }),
  };
}

/**
 * Name to the uid's default, motto empty, avatar to the uid's preset,
 * `shareStatus` kept. `profileChanged` and `boardProfileChanged` follow by
 * themselves.
 */
async function resetProfile(
  deps: AdminDeps,
  uid: string,
  now: number
): Promise<Omit<Done, 'uid'>> {
  const { db, engine } = deps;
  const ref = db.doc(`profiles/${uid}`);
  const profile = await ref.get();
  if (!profile.exists) {
    return { ok: false, error: 'no-profile' };
  }
  const fresh = engine.defaultProfile(uid);
  const update = {
    name: fresh.name,
    motto: '',
    avatar: fresh.avatar,
    updatedAt: Timestamp.fromMillis(now),
  };
  await ref.update(update);
  await notify(db, uid, 'profile-reset', now);
  await countModeration(db, uid, 'resets');
  return {
    ok: true,
    before: profileRecord(profile.data()),
    after: profileRecord({ ...profile.data(), ...update }),
  };
}

/** Avatar to the uid's preset, the rest kept. */
async function removeImage(
  deps: AdminDeps,
  uid: string,
  now: number
): Promise<Omit<Done, 'uid'>> {
  const { db, engine } = deps;
  const ref = db.doc(`profiles/${uid}`);
  const profile = await ref.get();
  const kind = (profile.get('avatar') as { kind?: string } | undefined)?.kind;
  if (!profile.exists || kind === undefined || kind === 'preset') {
    return { ok: false, error: 'no-image' };
  }
  const avatar = engine.defaultProfile(uid).avatar;
  await ref.update({ avatar, updatedAt: Timestamp.fromMillis(now) });
  await notify(db, uid, 'image-removed', now);
  await countModeration(db, uid, 'imageRemovals');
  return {
    ok: true,
    before: profileRecord(profile.data()),
    after: profileRecord({ ...profile.data(), avatar }),
  };
}

/** What the audit keeps of the owner's hides. */
function hidesOf(member: MemberDoc) {
  return {
    hidden: Object.entries(member.hiddenBy)
      .filter(([, by]) => by === 'admin')
      .map(([boardId]) => boardId)
      .sort(),
    barred: [...member.barred].sort(),
  };
}

/**
 * Hides an entry, or every entry of the player (`hiddenBy: 'admin'`). With
 * `bar`, that board kind - or every kind - ignores the player from now on.
 */
async function hide(
  deps: AdminDeps,
  command: AdminCommand,
  uid: string,
  now: number
): Promise<Omit<Done, 'uid'>> {
  const { db, engine } = deps;
  let before: ReturnType<typeof hidesOf> | null = null;
  let after: ReturnType<typeof hidesOf> | null = null;
  // `board.hidePlayer` may name the player by one of their entries; it
  // still hides them on every board.
  const entry =
    command.type === 'board.hideEntry' ? entryOf(command.target) : undefined;
  const bar = 'bar' in command.args && command.args.bar === true;
  await refreshEntries(db, engine, uid, now, (member) => {
    before = hidesOf(member);
    const boards = entry === undefined ? member.boards : [entry.boardId];
    for (const boardId of boards) {
      member.hiddenBy[boardId] = 'admin';
    }
    if (bar) {
      const kinds: BoardKind[] =
        entry === undefined
          ? [...engine.BOARD_KINDS]
          : [kindOf(engine, entry.boardId)];
      member.barred = [...new Set([...member.barred, ...kinds])];
    }
    after = hidesOf(member);
  });
  if (before === null) {
    return { ok: false, error: 'no-entries' };
  }
  await notify(db, uid, 'board-hidden', now);
  await countModeration(db, uid, 'hides');
  return { ok: true, before, after };
}

/** Undoes the owner's hide and bar; entries come back with their status. */
async function restore(
  deps: AdminDeps,
  command: AdminCommand,
  uid: string,
  now: number
): Promise<Omit<Done, 'uid'>> {
  const { db, engine } = deps;
  let before: ReturnType<typeof hidesOf> | null = null;
  let after: ReturnType<typeof hidesOf> | null = null;
  const boardId = entryOf(command.target)?.boardId;
  await refreshEntries(db, engine, uid, now, (member) => {
    before = hidesOf(member);
    for (const [id, by] of Object.entries(member.hiddenBy)) {
      if (by === 'admin' && (boardId === undefined || id === boardId)) {
        delete member.hiddenBy[id];
      }
    }
    member.barred =
      boardId === undefined
        ? []
        : member.barred.filter((kind) => kind !== kindOf(engine, boardId));
    after = hidesOf(member);
  });
  return before === null
    ? { ok: false, error: 'no-entries' }
    : { ok: true, before, after };
}

/**
 * Re-runs the entry's best attempt, or up to 6 match minutes of its run,
 * now, from the admin budget. The rest of a deep run is queued first for
 * the hourly function.
 */
async function verifyNow(
  deps: AdminDeps,
  command: AdminCommand,
  uid: string,
  now: number
): Promise<Omit<Done, 'uid'>> {
  const { db, engine } = deps;
  const board = engine.parseBoardId(entryOf(command.target)?.boardId ?? '');
  const pay = fixedPool('admin');
  if (board?.kind === 'daily') {
    const outcome = await verifyDaily(db, engine, uid, board.day, pay, now);
    return {
      ok: outcome === 'verified' || outcome === 'failed' || outcome === 'stale',
      ...(outcome === 'verified' ? {} : { error: outcome }),
      after: { outcome },
    };
  }
  if (board?.kind !== 'endless') {
    return { ok: false, error: 'not-verifiable' };
  }
  const outcome = await verifyRun(
    db,
    engine,
    uid,
    pay,
    minuteTicks(engine, ADMIN_RUN_MINUTES),
    now
  );
  const best = await db
    .collection('endlessRuns')
    .where('uid', '==', uid)
    .where('best', '==', true)
    .limit(1)
    .get();
  const run = best.docs[0]?.data() as EndlessRunDoc | undefined;
  const rest =
    run !== undefined &&
    run.cutAt === undefined &&
    run.matches.some(
      (match) => match.state === 'won' && match.verified !== true
    );
  if (rest && best.docs[0] !== undefined) {
    await best.docs[0].ref.update({ queued: true });
  }
  return {
    ok: outcome === 'verified' || outcome === 'failed' || outcome === 'stale',
    ...(outcome === 'verified' ? {} : { error: outcome }),
    after: { outcome, queued: rest },
  };
}
