import {
  computed,
  effect,
  inject,
  Injectable,
  Signal,
  signal,
  untracked,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  filter,
  firstValueFrom,
  map,
  Observable,
  of,
  shareReplay,
  startWith,
  switchMap,
} from 'rxjs';
import { injectGameAnalytics } from '../analytics/game-analytics';
import { ModerationService } from '../moderation/moderation.service';
import { OnlineMatchService } from '../net/online-match.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import type { GameSocial, PresenceState } from '../storage/game-social';
import { GameStateStore, isMatchOn } from '../state/game.states';
import { defaultProfile, parseProfile, PlayerCard, Profile } from './profile';

/** The player's stored profile as read, unparsed. */
interface StoredProfile {
  uid: string;
  value: unknown;
  failed: boolean;
}

/** A friend as the lobby lists them. */
export interface FriendView {
  uid: string;
  card: PlayerCard;
  /** False while they have not put the player on their list as well. */
  mutual: boolean;
  /** Online or playing - null while offline or not shared. */
  status: PresenceState | null;
}

/** Someone who asked to be friends, or challenged the player. */
export interface Caller {
  uid: string;
  card: PlayerCard;
}

/** A friend's challenge, with the room to join. */
export interface ChallengeView extends Caller {
  code: string;
}

/**
 * The player among other players: their own profile, their friends with
 * their cards and online status, the requests and challenges they got, and
 * whether they show up as online themselves - see ADR 0010. Everything is
 * empty without the game's Firebase project.
 */
@Injectable({ providedIn: 'root' })
export class SocialService {
  private readonly cloud = inject(GameCloud);
  private readonly account = inject(GameAccount);
  private readonly store = inject(GameStateStore);
  private readonly online = inject(OnlineMatchService);
  private readonly moderation = inject(ModerationService);
  private readonly analytics = injectGameAnalytics();
  private readonly social = this.cloud.social();
  private readonly presence = this.cloud.presence();
  /** Cards already watched, by uid - each is read once, however often shown. */
  private readonly cards = new Map<string, Observable<PlayerCard>>();

  /** False without the cloud: no profiles, no friends. */
  public readonly available = this.social !== null;
  /** False without a database for the online status. */
  public readonly presenceAvailable = this.presence !== null;

  private readonly uid$ = this.account.players.pipe(
    map(({ playerId }) => playerId),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: false })
  );
  /** Who plays - null between players and without the cloud. */
  public readonly uid = toSignal(this.uid$, { initialValue: null });

  /** The stored profile as read, or why it is not: it failed to read. */
  private readonly stored = toSignal(
    this.uid$.pipe(
      switchMap((uid) =>
        uid === null || this.social === null
          ? of(null)
          : this.social.watchProfile(uid).pipe(
              map((value): StoredProfile => ({ uid, value, failed: false })),
              catchError(() =>
                of<StoredProfile>({ uid, value: null, failed: true })
              )
            )
      )
    ),
    { initialValue: null }
  );

  /**
   * True once the player's stored profile was read - or the server said
   * there is none. Until then `profile` is made up, and saving it would
   * write its defaults over what is stored.
   */
  public readonly profileLoaded = computed(() => {
    const stored = this.stored();
    return stored !== null && stored.uid === this.uid() && !stored.failed;
  });

  /** The profile as stored - null while none is, or it is not read yet. */
  private readonly storedProfile = computed(() => {
    const stored = this.stored();
    const uid = this.uid();
    return stored !== null && stored.uid === uid && uid !== null
      ? parseProfile(stored.value, uid)
      : null;
  });

  /** The player's profile - the stored one, else one made from their uid. */
  public readonly profile: Signal<Profile | null> = computed(() => {
    const uid = this.uid();
    if (uid === null || !this.available) {
      return null;
    }
    return (
      this.storedProfile() ??
      defaultProfile(uid, this.account.profile()?.name ?? null)
    );
  });

  /** The player's friends, with whether it is mutual and who is online. */
  public readonly friends = toSignal(
    this.forPlayer((social, me) =>
      social.watchFriends(me).pipe(
        switchMap((uids) =>
          uids.length === 0
            ? of([])
            : combineLatest(
                uids.map((uid) =>
                  combineLatest([
                    this.card(uid),
                    // The status only of a friend who lists the player too:
                    // only they may read it (ADR 0012).
                    social.watchListedBy(uid, me).pipe(
                      startWith(false),
                      distinctUntilChanged(),
                      switchMap((mutual) =>
                        mutual
                          ? this.statusOf(uid).pipe(
                              map((status) => ({ mutual, status }))
                            )
                          : of({ mutual, status: null })
                      )
                    ),
                  ]).pipe(
                    map(([card, { mutual, status }]): FriendView => ({
                      uid,
                      card,
                      mutual,
                      status,
                    }))
                  )
                )
              )
        ),
        map((friends) => friends.slice().sort(byStatusThenName))
      )
    ),
    { initialValue: [] as FriendView[] }
  );

  /** Who asked to be friends with the player. */
  public readonly requests = toSignal(
    this.forPlayer((social, me) =>
      social.watchRequests(me).pipe(switchMap((uids) => this.callers(uids)))
    ),
    { initialValue: [] as Caller[] }
  );

  /** The challenges of friends, waiting for an answer. */
  public readonly challenges = toSignal(
    this.forPlayer((social, me) =>
      social
        .watchChallenges(me)
        .pipe(
          switchMap((challenges) =>
            challenges.length === 0
              ? of([])
              : combineLatest(
                  challenges.map(({ from, code }) =>
                    this.card(from).pipe(
                      map((card): ChallengeView => ({ uid: from, card, code }))
                    )
                  )
                )
          )
        )
    ),
    { initialValue: [] as ChallengeView[] }
  );

  /** The card of the player at the other device of an online match. */
  public readonly opponent = toSignal(
    toObservable(this.online.peer).pipe(
      switchMap((uid) =>
        uid === null || !this.available
          ? of(null)
          : this.card(uid).pipe(map((card) => ({ uid, card })))
      )
    ),
    { initialValue: null }
  );

  /** True while the opponent is on the player's friend list. */
  public readonly opponentIsFriend = computed(() => {
    const uid = this.opponent()?.uid;
    return uid !== undefined && this.friends().some((f) => f.uid === uid);
  });

  private readonly challengedState = signal<FriendView | null>(null);
  /** The friend challenged to the room this player opened, if any. */
  public readonly challenged = this.challengedState.asReadonly();

  public constructor() {
    // A lobby back to idle ends the challenge.
    effect(() => {
      if (this.online.lobby().phase === 'idle') {
        untracked(() => this.challengedState.set(null));
      }
    });

    // The player shows up as online while they share it - playing while an
    // online match is on. Nothing is told before their stored profile is
    // read, which may say they do not share it, and the status goes with
    // the player who signs out - and with a ban, under which the database
    // refuses it (ADR 0012).
    let shown: string | null = null;
    effect(() => {
      const presence = this.presence;
      const uid = this.uid();
      const loaded = this.profileLoaded();
      const profile = this.profile();
      const banned = this.moderation.banned();
      const playing =
        this.store.online() !== null && isMatchOn(this.store.currentState());
      if (presence === null) {
        return;
      }
      if (shown !== null && shown !== uid) {
        presence.set(shown, null);
        shown = null;
      }
      if (uid === null || !loaded) {
        return;
      }
      shown = uid;
      presence.set(
        uid,
        profile?.shareStatus === true && !banned
          ? playing
            ? 'playing'
            : 'online'
          : null
      );
    });
  }

  /**
   * Saves the fields given - the ones the player changed - over the stored
   * profile; a first profile is saved whole, from `profile`. Refused until
   * the stored profile is read, so its flags are never written blind.
   */
  public async saveProfile(changes: Partial<Profile>): Promise<void> {
    const uid = this.uid();
    const profile = this.profile();
    if (uid === null || profile === null || this.social === null) {
      return;
    }
    if (!this.profileLoaded()) {
      throw new Error('The stored profile is not read yet');
    }
    this.assertNotBanned();
    const first = this.storedProfile() === null;
    await this.social.saveProfile(
      uid,
      first ? { ...profile, ...changes } : changes
    );
    this.analytics.track('profile_saved', { first });
  }

  /** What others see of a player - a made-up card until theirs is read. */
  public card(uid: string): Observable<PlayerCard> {
    let card = this.cards.get(uid);
    if (card === undefined) {
      const fallback = defaultProfile(uid);
      card =
        this.social === null
          ? of(fallback)
          : this.social.watchProfile(uid).pipe(
              map((value) => parseProfile(value, uid) ?? fallback),
              startWith(fallback),
              catchError(() => of(fallback)),
              shareReplay({ bufferSize: 1, refCount: true })
            );
      this.cards.set(uid, card);
    }
    return card;
  }

  /** Asks a player - the opponent of a match - to be friends. */
  public async addFriend(uid: string): Promise<void> {
    const sent = await this.withWriter((social, me) =>
      me === uid ? Promise.resolve(null) : social.sendRequest(me, uid)
    );
    if (sent !== null) {
      this.analytics.track('friend_request_sent');
    }
  }

  public async acceptRequest(uid: string): Promise<void> {
    const done = await this.withWriter((social, me) =>
      social.acceptRequest(me, uid)
    );
    if (done !== null) {
      this.analytics.track('friend_request_answered', { accepted: true });
    }
  }

  public async declineRequest(uid: string): Promise<void> {
    const done = await this.withPlayer((social, me) =>
      social.declineRequest(me, uid)
    );
    if (done !== null) {
      this.analytics.track('friend_request_answered', { accepted: false });
    }
  }

  public async removeFriend(uid: string): Promise<void> {
    const done = await this.withPlayer((social, me) =>
      social.removeFriend(me, uid)
    );
    if (done !== null) {
      this.analytics.track('friend_removed');
    }
  }

  /** A link that makes whoever opens it the player's friend, for a week. */
  public async inviteLink(base: string): Promise<string | null> {
    const token = await this.withWriter((social, me) =>
      social.createInvite(me)
    );
    return token === null ? null : `${base.split('#')[0]}#friend=${token}`;
  }

  /**
   * The uid of the player who made an invitation - null when there is
   * none, it ran out, or it is the player's own.
   */
  public async readInvite(token: string): Promise<string | null> {
    if (this.social === null) {
      return null;
    }
    // Read as a signed-in player: on a fresh visit the guest comes later.
    const me = await firstValueFrom(
      this.uid$.pipe(filter((uid): uid is string => uid !== null))
    );
    const from = await this.social.readInvite(token);
    return from === me ? null : from;
  }

  public async acceptInvite(token: string, from: string): Promise<void> {
    const done = await this.withWriter((social, me) =>
      social.acceptInvite(me, token, from)
    );
    if (done !== null) {
      this.analytics.track('invite_accepted');
    }
  }

  /** Challenges a friend to the match in room `code`. */
  public async challenge(friend: string, code: string): Promise<void> {
    const done = await this.withWriter((social, me) =>
      social.challenge(me, friend, code)
    );
    if (done !== null) {
      this.analytics.track('challenge_sent');
    }
  }

  /**
   * Opens a room and challenges the friend to it - from the lobby or the
   * friends screen. A challenge that does not go out leaves the room again.
   */
  public challengeFriend(friend: FriendView): void {
    this.challengedState.set(friend);
    void this.online.host({
      onCode: (code) =>
        void this.challenge(friend.uid, code).catch((error: unknown) => {
          console.error('Could not challenge', error);
          this.online.leave();
        }),
    });
  }

  /**
   * Takes back the challenge to the room this player opened, unless the
   * friend is already there - leaving the room is the caller's part.
   */
  public cancelChallenge(): void {
    const friend = this.challengedState();
    if (friend !== null && this.online.lobby().phase !== 'connected') {
      void this.withdrawChallenge(friend.uid).catch(() => undefined);
    }
  }

  /** Answers a challenge - joining is the caller's part. */
  public async clearChallenge(from: string): Promise<void> {
    await this.withPlayer((social, me) => social.clearChallenge(me, from));
  }

  /** Takes back the player's own challenge to a friend. */
  public async withdrawChallenge(friend: string): Promise<void> {
    await this.withPlayer((social, me) => social.clearChallenge(friend, me));
  }

  /** A friend's online status, null without a database for it. */
  private statusOf(uid: string): Observable<PresenceState | null> {
    return this.presence === null
      ? of(null)
      : this.presence.watch(uid).pipe(startWith<PresenceState | null>(null));
  }

  private callers(uids: string[]): Observable<Caller[]> {
    return uids.length === 0
      ? of([])
      : combineLatest(
          uids.map((uid) => this.card(uid).pipe(map((card) => ({ uid, card }))))
        );
  }

  /** What `watch` makes of the player playing now - nothing between players. */
  private forPlayer<T>(
    watch: (social: GameSocial, me: string) => Observable<T[]>
  ): Observable<T[]> {
    const social = this.social;
    return this.uid$.pipe(
      switchMap((me) =>
        me === null || social === null
          ? of([])
          : watch(social, me).pipe(catchError(() => of([])))
      )
    );
  }

  /**
   * What `task` writes for the player - nothing while a ban holds, under
   * which the rules refuse it (ADR 0012); taking things back stays open.
   */
  private async withWriter<T>(
    task: (social: GameSocial, me: string) => Promise<T>
  ): Promise<T | null> {
    this.assertNotBanned();
    return this.withPlayer(task);
  }

  /** Throws while a ban holds: the rules refuse the player's writes then. */
  private assertNotBanned(): void {
    if (this.moderation.banned()) {
      throw new Error('The account is suspended');
    }
  }

  private async withPlayer<T>(
    task: (social: GameSocial, me: string) => Promise<T>
  ): Promise<T | null> {
    const me = this.uid();
    if (me === null || this.social === null) {
      return null;
    }
    return task(this.social, me);
  }
}

/** Playing, then online, then the rest - by name within each. */
function byStatusThenName(a: FriendView, b: FriendView): number {
  const rank = (friend: FriendView) =>
    friend.status === 'online' ? 0 : friend.status === 'playing' ? 1 : 2;
  return rank(a) - rank(b) || a.card.name.localeCompare(b.card.name);
}
