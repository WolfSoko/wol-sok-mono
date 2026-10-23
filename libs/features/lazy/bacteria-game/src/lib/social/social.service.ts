import { computed, effect, inject, Injectable, Signal } from '@angular/core';
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
import { OnlineMatchService } from '../net/online-match.service';
import { GameAccount } from '../storage/game-account';
import { GameCloud } from '../storage/game-cloud';
import type { GameSocial, PresenceState } from '../storage/game-social';
import { GameStateStore, isMatchOn } from '../state/game.states';
import { defaultProfile, parseProfile, PlayerCard, Profile } from './profile';

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

  private readonly stored = toSignal(
    this.uid$.pipe(
      switchMap((uid) =>
        uid === null || this.social === null
          ? of(null)
          : this.social.watchProfile(uid).pipe(
              map((value): { uid: string; value: unknown } => ({ uid, value })),
              catchError(() => of({ uid, value: null }))
            )
      )
    ),
    { initialValue: null }
  );

  /** The player's profile - the stored one, else one made from their uid. */
  public readonly profile: Signal<Profile | null> = computed(() => {
    const uid = this.uid();
    if (uid === null || !this.available) {
      return null;
    }
    const stored = this.stored();
    const parsed = stored?.uid === uid ? parseProfile(stored.value, uid) : null;
    return parsed ?? defaultProfile(uid, this.account.profile()?.name ?? null);
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
                    social.watchListedBy(uid, me).pipe(startWith(false)),
                    this.statusOf(uid),
                  ]).pipe(
                    map(([card, mutual, status]): FriendView => ({
                      uid,
                      card,
                      mutual,
                      status: mutual ? status : null,
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

  public constructor() {
    // The player shows up as online while they share it - playing while an
    // online match is on. Nothing is told before their stored profile is
    // read, which may say they do not share it, and the status goes with
    // the player who signs out.
    let shown: string | null = null;
    effect(() => {
      const presence = this.presence;
      const uid = this.uid();
      const loaded = this.stored()?.uid === uid;
      const profile = this.profile();
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
        profile?.shareStatus === true ? (playing ? 'playing' : 'online') : null
      );
    });
  }

  public async saveProfile(profile: Profile): Promise<void> {
    const uid = this.uid();
    if (uid !== null) {
      await this.social?.saveProfile(uid, profile);
    }
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
    await this.withPlayer((social, me) =>
      me === uid ? Promise.resolve() : social.sendRequest(me, uid)
    );
  }

  public async acceptRequest(uid: string): Promise<void> {
    await this.withPlayer((social, me) => social.acceptRequest(me, uid));
  }

  public async declineRequest(uid: string): Promise<void> {
    await this.withPlayer((social, me) => social.declineRequest(me, uid));
  }

  public async removeFriend(uid: string): Promise<void> {
    await this.withPlayer((social, me) => social.removeFriend(me, uid));
  }

  /** A link that makes whoever opens it the player's friend, for a week. */
  public async inviteLink(base: string): Promise<string | null> {
    const token = await this.withPlayer((social, me) =>
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
    await this.withPlayer((social, me) => social.acceptInvite(me, token, from));
  }

  /** Challenges a friend to the match in room `code`. */
  public async challenge(friend: string, code: string): Promise<void> {
    await this.withPlayer((social, me) => social.challenge(me, friend, code));
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
