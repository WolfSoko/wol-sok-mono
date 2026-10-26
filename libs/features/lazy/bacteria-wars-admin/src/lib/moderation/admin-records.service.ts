import { inject, Injectable } from '@angular/core';
import {
  type BoardKind,
  type FirebaseConnection,
  GameCloud,
  parseProfile,
  type Profile,
} from '@wolsok/feat-lazy-bac-game/admin-kit';
import {
  type AuditRecord,
  type BanRecord,
  type BoardEntryRecord,
  type CandidateDayRecord,
  type EntryRecord,
  type LevelStatsRecord,
  type MemberEntryRef,
  type MemberRecord,
  millisOf,
  type ModerationRecord,
  type ProfileFlags,
  parseAudit,
  parseBan,
  parseBoardEntry,
  parseCandidateDay,
  parseEntry,
  parseLevelStats,
  parseMember,
  parseModeration,
  parseProfileFlags,
  parsePublicReplay,
  parseStoredReplay,
  type PublicReplayRecord,
  type StoredReplayRecord,
} from './admin-records';

/** How many rows a list loads at a time. */
export const PAGE_SIZE = 25;

/** The most values a Firestore `in` filter takes. */
const IN_LIMIT = 30;

/** One page of a list, and where the next one starts (null at the end). */
export interface Page<T> {
  rows: T[];
  next: unknown;
}

/** A profile in the list. */
export interface ProfileRow {
  uid: string;
  profile: Profile;
  updatedAt: number | null;
}

/** Which profiles the list shows. */
export type ProfileFilter =
  | { by: 'newest' }
  | { by: 'pictures' }
  | { by: 'name'; prefix: string };

/** Which audit entries the list shows, newest first. */
export type AuditFilter =
  | { by: 'all' }
  | { by: 'type'; type: string }
  | { by: 'uid'; uid: string };

/** Everything the player view shows about one player. */
export interface PlayerRecord {
  profile: Profile | null;
  flags: ProfileFlags;
  member: MemberRecord;
  ban: BanRecord | null;
  moderation: ModerationRecord;
  entries: (MemberEntryRef & { record: EntryRecord | null })[];
}

type Db = FirebaseConnection['dbSdk'];
type Snapshot = Awaited<ReturnType<Db['getDocs']>>['docs'][number];

/**
 * Reads the moderation records (ADR 0012) - the rules let only the owner
 * list profiles and bans, and read memberships, counters and the audit.
 * Lists load a page at a time; the player view follows its documents live,
 * so a command's effect shows without a reload.
 */
@Injectable({ providedIn: 'root' })
export class AdminRecordsService {
  private readonly cloud = inject(GameCloud);

  public async profiles(
    filter: ProfileFilter,
    after: unknown = null
  ): Promise<Page<ProfileRow>> {
    const { db, dbSdk: sdk } = this.connection();
    const profiles = sdk.collection(db, 'profiles');
    const order =
      filter.by === 'name'
        ? [
            sdk.where('name', '>=', filter.prefix),
            sdk.where('name', '<', `${filter.prefix}`),
            sdk.orderBy('name'),
          ]
        : [
            ...(filter.by === 'pictures'
              ? [sdk.where('avatar.kind', '==', 'image')]
              : []),
            sdk.orderBy('updatedAt', 'desc'),
          ];
    return this.page(
      sdk,
      sdk.query(profiles, ...order),
      after,
      (doc): ProfileRow | null => {
        const profile = parseProfile(doc.data(), doc.id);
        return profile === null
          ? null
          : { uid: doc.id, profile, updatedAt: millisOf(doc.get('updatedAt')) };
      }
    );
  }

  /** A board's entries, best first - hidden ones too. */
  public async boardEntries(
    boardId: string,
    after: unknown = null
  ): Promise<Page<BoardEntryRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    return this.page(
      sdk,
      sdk.query(
        sdk.collection(db, 'boards', boardId, 'entries'),
        sdk.orderBy('sort', 'desc')
      ),
      after,
      (doc) => parseBoardEntry(doc.id, doc.data())
    );
  }

  /**
   * The players behind entries of a board kind: entries carry no uid,
   * `boardMembers` maps them (`entryIds.<kind>`). One query per 30 ids
   * (Firestore's `in` limit); null for an id nobody holds.
   */
  public async entryOwners(
    kind: BoardKind,
    entryIds: readonly string[]
  ): Promise<Record<string, string | null>> {
    const { db, dbSdk: sdk } = this.connection();
    const field = `entryIds.${kind}`;
    const owners: Record<string, string | null> = Object.fromEntries(
      entryIds.map((id) => [id, null])
    );
    const chunks: string[][] = [];
    for (let i = 0; i < entryIds.length; i += IN_LIMIT) {
      chunks.push(entryIds.slice(i, i + IN_LIMIT));
    }
    const snapshots = await Promise.all(
      chunks.map((ids) =>
        sdk.getDocs(
          sdk.query(
            sdk.collection(db, 'boardMembers'),
            sdk.where(field, 'in', ids)
          )
        )
      )
    );
    for (const doc of snapshots.flatMap((snapshot) => snapshot.docs)) {
      const entryId: unknown = doc.get(field);
      if (typeof entryId === 'string' && entryId in owners) {
        owners[entryId] = doc.id;
      }
    }
    return owners;
  }

  /**
   * The gallery's daily picks, newest day first, with their runners-up -
   * ordered by `day` (the document id, as a field), whose index Firestore
   * keeps by default, unlike one on the id in descending order.
   */
  public async candidateDays(
    after: unknown = null
  ): Promise<Page<CandidateDayRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    return this.page(
      sdk,
      sdk.query(
        sdk.collection(db, 'replayCandidates'),
        sdk.orderBy('day', 'desc')
      ),
      after,
      (doc) => parseCandidateDay(doc.id, doc.data())
    );
  }

  /** The public replays still up, newest featured first. */
  public async publicReplays(
    after: unknown = null
  ): Promise<Page<PublicReplayRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    return this.page(
      sdk,
      sdk.query(
        sdk.collection(db, 'publicReplays'),
        sdk.where('removedAt', '==', null),
        sdk.orderBy('featuredAt', 'desc')
      ),
      after,
      (doc) => parsePublicReplay(doc.id, doc.data())
    );
  }

  /** A stored replay, null when there is none. */
  public async storedReplay(
    replayId: string
  ): Promise<StoredReplayRecord | null> {
    const { db, dbSdk: sdk } = this.connection();
    const snapshot = await sdk.getDoc(sdk.doc(db, 'replays', replayId));
    return parseStoredReplay(replayId, snapshot.data());
  }

  /**
   * The level statistics of one balance version, by level - ordered by a
   * field every document has (`level`, part of its key), since Firestore
   * leaves out documents without the ordered field.
   */
  public async levelStats(
    balanceVersion: number,
    after: unknown = null
  ): Promise<Page<LevelStatsRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    return this.page(
      sdk,
      sdk.query(
        sdk.collection(db, 'levelStats'),
        sdk.where('balanceVersion', '==', balanceVersion),
        sdk.orderBy('level')
      ),
      after,
      (doc) => parseLevelStats(doc.id, doc.data())
    );
  }

  /** The bans, newest first; the hourly sweep deletes the ended ones. */
  public async bans(after: unknown = null): Promise<Page<BanRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    return this.page(
      sdk,
      sdk.query(sdk.collection(db, 'bans'), sdk.orderBy('since', 'desc')),
      after,
      (doc) => parseBan(doc.id, doc.data())
    );
  }

  public async audit(
    filter: AuditFilter,
    after: unknown = null
  ): Promise<Page<AuditRecord>> {
    const { db, dbSdk: sdk } = this.connection();
    const where =
      filter.by === 'type'
        ? [sdk.where('type', '==', filter.type)]
        : filter.by === 'uid'
          ? [sdk.where('target.uid', '==', filter.uid)]
          : [];
    return this.page(
      sdk,
      sdk.query(
        sdk.collection(db, 'adminAudit'),
        ...where,
        sdk.orderBy('at', 'desc')
      ),
      after,
      (doc) => parseAudit(doc.id, doc.data())
    );
  }

  /**
   * Follows a player's profile, membership, ban and counters, and the
   * entries the membership points to. Returns the function that stops.
   */
  public watchPlayer(
    uid: string,
    next: (player: PlayerRecord) => void
  ): () => void {
    const { db, dbSdk: sdk } = this.connection();
    const player: PlayerRecord = {
      profile: null,
      flags: parseProfileFlags(undefined),
      member: parseMember(undefined),
      ban: null,
      moderation: parseModeration(undefined),
      entries: [],
    };
    const emit = () => next({ ...player, entries: [...player.entries] });
    const fail = (what: string) => (error: unknown) =>
      console.error(`Could not read the player's ${what}`, error);
    let stopEntries: (() => void)[] = [];
    const watchEntries = (refs: MemberEntryRef[]) => {
      stopEntries.forEach((stop) => stop());
      player.entries = refs.map((ref) => ({ ...ref, record: null }));
      stopEntries = refs.map((ref, i) =>
        sdk.onSnapshot(
          sdk.doc(db, 'boards', ref.boardId, 'entries', ref.entryId),
          (snapshot) => {
            player.entries[i] = { ...ref, record: parseEntry(snapshot.data()) };
            emit();
          },
          fail('entry')
        )
      );
    };
    const stops = [
      sdk.onSnapshot(
        sdk.doc(db, 'profiles', uid),
        (snapshot) => {
          player.profile = parseProfile(snapshot.data(), uid);
          player.flags = parseProfileFlags(snapshot.data());
          emit();
        },
        fail('profile')
      ),
      sdk.onSnapshot(
        sdk.doc(db, 'boardMembers', uid),
        (snapshot) => {
          player.member = parseMember(snapshot.data());
          watchEntries(player.member.entries);
          emit();
        },
        fail('board membership')
      ),
      sdk.onSnapshot(
        sdk.doc(db, 'bans', uid),
        (snapshot) => {
          player.ban = parseBan(uid, snapshot.data());
          emit();
        },
        fail('ban')
      ),
      sdk.onSnapshot(
        sdk.doc(db, 'moderation', uid),
        (snapshot) => {
          player.moderation = parseModeration(snapshot.data());
          emit();
        },
        fail('moderation counters')
      ),
    ];
    return () => [...stops, ...stopEntries].forEach((stop) => stop());
  }

  private connection(): FirebaseConnection {
    const connection = this.cloud.firebase();
    if (connection === null) {
      throw new Error('No Firebase project is set up for this build.');
    }
    return connection;
  }

  private async page<T>(
    sdk: Db,
    query: ReturnType<Db['query']>,
    after: unknown,
    parse: (doc: Snapshot) => T | null
  ): Promise<Page<T>> {
    const snapshot = await sdk.getDocs(
      sdk.query(
        query,
        ...(after === null ? [] : [sdk.startAfter(after)]),
        sdk.limit(PAGE_SIZE)
      )
    );
    const docs = snapshot.docs;
    return {
      rows: docs.flatMap((doc) => {
        const row = parse(doc);
        return row === null ? [] : [row];
      }),
      next: docs.length === PAGE_SIZE ? docs[docs.length - 1] : null,
    };
  }
}
