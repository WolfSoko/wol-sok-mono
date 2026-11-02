import { BehaviorSubject, EMPTY, map, Observable, switchMap } from 'rxjs';
import type { Profile } from '../lib/social/profile';
import type { PickedMatchLevel } from '../lib/state/match-level';
import type {
  Challenge,
  GamePresence,
  GameSocial,
  PresenceState,
  QueueEntry,
  Waiting,
} from '../lib/storage/game-social';

/**
 * Profiles, friends, challenges and the queue in memory, for specs: one
 * fake stands for the whole project, so two players' services can share
 * it. It answers at once and keeps no rules - the e2e tests run those.
 */
export class FakeGameSocial implements GameSocial {
  private readonly docs = new BehaviorSubject<ReadonlyMap<string, unknown>>(
    new Map()
  );
  private clock = 1000;
  private tokens = 0;

  /** False holds the profiles back, as before the server answered. */
  public readonly profilesAnswer = new BehaviorSubject(true);

  public watchProfile(uid: string): Observable<unknown> {
    return this.profilesAnswer.pipe(
      switchMap((answer) => (answer ? this.watch(`profiles/${uid}`) : EMPTY))
    );
  }

  public async saveProfile(
    uid: string,
    profile: Partial<Profile>
  ): Promise<void> {
    const stored = this.docs.value.get(`profiles/${uid}`);
    this.put(`profiles/${uid}`, {
      ...(typeof stored === 'object' ? stored : {}),
      ...profile,
    });
  }

  public watchFriends(uid: string): Observable<string[]> {
    return this.watchIds(`players/${uid}/friends/`);
  }

  public watchListedBy(of: string, me: string): Observable<boolean> {
    return this.watch(`players/${of}/friends/${me}`).pipe(
      map((value) => value !== null)
    );
  }

  public watchRequests(uid: string): Observable<string[]> {
    return this.watchIds(`players/${uid}/requests/`);
  }

  public async sendRequest(me: string, to: string): Promise<void> {
    this.put(`players/${me}/friends/${to}`, {});
    this.put(`players/${to}/requests/${me}`, {});
  }

  public async acceptRequest(me: string, from: string): Promise<void> {
    this.put(`players/${me}/friends/${from}`, {});
    this.remove(`players/${me}/requests/${from}`);
  }

  public async declineRequest(me: string, from: string): Promise<void> {
    this.remove(`players/${me}/requests/${from}`);
  }

  public async removeFriend(me: string, friend: string): Promise<void> {
    this.remove(`players/${me}/friends/${friend}`);
    this.remove(`players/${friend}/friends/${me}`);
  }

  public async createInvite(me: string): Promise<string> {
    const token = `token${String(++this.tokens).padStart(15, '2')}`;
    this.put(`invites/${token}`, { from: me });
    return token;
  }

  public async readInvite(token: string): Promise<string | null> {
    const invite = this.get(`invites/${token}`) as { from: string } | null;
    return invite?.from ?? null;
  }

  public async acceptInvite(
    me: string,
    _token: string,
    from: string
  ): Promise<void> {
    this.put(`players/${me}/friends/${from}`, {});
    this.put(`players/${from}/friends/${me}`, {});
  }

  public async challenge(
    me: string,
    friend: string,
    code: string
  ): Promise<void> {
    this.put(`players/${friend}/challenges/${me}`, { code });
  }

  public watchChallenges(uid: string): Observable<Challenge[]> {
    const prefix = `players/${uid}/challenges/`;
    return this.docs.pipe(
      map((docs) =>
        [...docs]
          .filter(([path]) => path.startsWith(prefix))
          .map(([path, value]) => ({
            from: path.slice(prefix.length),
            code: (value as { code: string }).code,
          }))
      )
    );
  }

  public async clearChallenge(to: string, from: string): Promise<void> {
    this.remove(`players/${to}/challenges/${from}`);
  }

  public async enqueue(
    uid: string,
    level: string | null = null
  ): Promise<void> {
    const now = this.tick();
    const entry: QueueEntry = {
      since: now,
      seen: now,
      level,
      claim: null,
      picked: null,
    };
    this.put(`queue/${uid}`, entry);
  }

  public async setQueueLevel(uid: string, level: string | null): Promise<void> {
    const entry = this.get(`queue/${uid}`) as QueueEntry | null;
    if (entry !== null) {
      this.put(`queue/${uid}`, { ...entry, level, seen: this.tick() });
    }
  }

  public async stillWaiting(uid: string): Promise<void> {
    const entry = this.get(`queue/${uid}`) as QueueEntry | null;
    if (entry !== null) {
      this.put(`queue/${uid}`, { ...entry, seen: this.tick() });
    }
  }

  public async leaveQueue(uid: string): Promise<void> {
    this.remove(`queue/${uid}`);
  }

  public watchQueueEntry(uid: string): Observable<QueueEntry | null> {
    return this.watch(`queue/${uid}`) as Observable<QueueEntry | null>;
  }

  public async waiting(limit: number, seenSince: number): Promise<Waiting[]> {
    return [...this.docs.value]
      .filter(([path]) => path.startsWith('queue/'))
      .map(([path, value]) => ({
        uid: path.slice('queue/'.length),
        ...(value as QueueEntry),
      }))
      .filter((entry) => (entry.seen ?? -Infinity) >= seenSince)
      .sort((a, b) => (a.since ?? 0) - (b.since ?? 0))
      .slice(0, limit);
  }

  public async claim(
    uid: string,
    _by: string,
    code: string,
    pick: (level: string | null) => PickedMatchLevel
  ): Promise<PickedMatchLevel | null> {
    const entry = this.get(`queue/${uid}`) as QueueEntry | null;
    if (entry === null || entry.claim !== null) {
      return null;
    }
    const picked = pick(entry.level ?? null);
    this.put(`queue/${uid}`, { ...entry, claim: code, picked });
    return picked;
  }

  /** What is stored under a path - null for nothing. */
  public get(path: string): unknown {
    return this.docs.value.get(path) ?? null;
  }

  public put(path: string, value: unknown): void {
    const docs = new Map(this.docs.value);
    docs.set(path, value);
    this.docs.next(docs);
  }

  public remove(path: string): void {
    const docs = new Map(this.docs.value);
    docs.delete(path);
    this.docs.next(docs);
  }

  private tick(): number {
    this.clock += 1000;
    return this.clock;
  }

  private watch(path: string): Observable<unknown> {
    return this.docs.pipe(map((docs) => docs.get(path) ?? null));
  }

  private watchIds(prefix: string): Observable<string[]> {
    return this.docs.pipe(
      map((docs) =>
        [...docs.keys()]
          .filter((path) => path.startsWith(prefix))
          .map((path) => path.slice(prefix.length))
      )
    );
  }
}

/** Who is online, in memory. */
export class FakeGamePresence implements GamePresence {
  private readonly states = new BehaviorSubject<
    ReadonlyMap<string, PresenceState>
  >(new Map());

  /** Every player whose status was asked for, in order. */
  public readonly watched: string[] = [];

  public watch(uid: string): Observable<PresenceState | null> {
    this.watched.push(uid);
    return this.states.pipe(map((states) => states.get(uid) ?? null));
  }

  public set(uid: string, state: PresenceState | null): void {
    const states = new Map(this.states.value);
    if (state === null) {
      states.delete(uid);
    } else {
      states.set(uid, state);
    }
    this.states.next(states);
  }

  /** What a player shares right now. */
  public stateOf(uid: string): PresenceState | null {
    return this.states.value.get(uid) ?? null;
  }
}
