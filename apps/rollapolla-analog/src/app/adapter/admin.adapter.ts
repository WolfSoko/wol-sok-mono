import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import {
  collection,
  collectionGroup,
  CollectionReference,
  deleteDoc,
  doc,
  Firestore,
  FirestoreDataConverter,
  getAggregateFromServer,
  getCountFromServer,
  limit,
  orderBy,
  query,
  Query,
  setDoc,
  sum,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import {
  distinctUntilChanged,
  firstValueFrom,
  map,
  Observable,
  shareReplay,
  switchMap,
} from 'rxjs';
import { count as aggregateCount } from 'firebase/firestore';
import { isGoogleAccount } from '../../shared/account';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
  toPage,
  UsersPage,
} from '../../shared/admin';
import {
  ADMIN_CLAIM,
  AppUserDto,
  SetRoleDto,
  UserStatsDto,
  UsersPageDto,
} from '../../shared/admin-api';
import { FeatureFlag } from '../../shared/app-config';
import { Poll } from '../../shared/poll';
import { AccountPort } from '../ports/account.port';
import { AdminPort } from '../ports/admin.port';
import { PollsRepoPort, WriteReceipt } from '../ports/polls-repo.port';
import { chatMessageConverter } from './chat-message.converter';
import { ChatMessageDto } from './chat-message.dto';
import { pollConverter } from './poll.converter';
import { PollDto } from './poll.dto';
import { queryData } from './snapshots';

/** Lobby messages live in `chatMessages`, a poll's in `polls/{id}/chatMessages`. */
const adminMessageConverter: FirestoreDataConverter<
  AdminChatMessage,
  ChatMessageDto
> = {
  toFirestore: (message: AdminChatMessage) =>
    chatMessageConverter.toFirestore(message),
  fromFirestore: (snapshot, options) => ({
    ...chatMessageConverter.fromFirestore(snapshot, options),
    pollId: snapshot.ref.parent.parent?.id ?? null,
  }),
};

function toAppUser(user: AppUserDto): AppUser {
  return {
    ...user,
    createdAt: new Date(user.createdAt),
    lastSignInAt: user.lastSignInAt ? new Date(user.lastSignInAt) : null,
  };
}

@Injectable()
export class AdminAdapter extends AdminPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly auth: Auth = inject(Auth);
  private readonly http = inject(HttpClient);
  private readonly pollsRepo = inject(PollsRepoPort);
  private readonly pollsCol: CollectionReference<Poll, PollDto> = collection(
    this.fs,
    'polls'
  ).withConverter<Poll, PollDto>(pollConverter);
  private readonly messagesGroup: Query<AdminChatMessage, ChatMessageDto> =
    collectionGroup(this.fs, 'chatMessages').withConverter(
      adminMessageConverter
    );

  /*
   * From the account, not authState: linking an anonymous visitor to Google
   * keeps the uid, and only AccountPort reports that. It also emits whenever
   * the sign-in token changes, e.g. after recheckAdmin().
   */
  public readonly isAdmin$: Observable<boolean> = inject(
    AccountPort
  ).account$.pipe(
    switchMap(async (account) => {
      const user = this.auth.currentUser;
      if (!isGoogleAccount(account) || user?.uid !== account.uid) {
        return false;
      }
      try {
        const { claims } = await user.getIdTokenResult();
        return claims[ADMIN_CLAIM] === true;
      } catch (error) {
        console.error('Could not check the admin rights', error);
        return false;
      }
    }),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true })
  );

  public async recheckAdmin(): Promise<void> {
    await this.auth.authStateReady();
    await this.auth.currentUser?.getIdToken(true);
  }

  public async loadStats(): Promise<AdminStats> {
    const polls = collection(this.fs, 'polls');
    const count = async (counted: Query<unknown>): Promise<number> =>
      (await getCountFromServer(counted)).data().count;
    const [
      pollTotals,
      listedPolls,
      openPolls,
      lobbyMessages,
      chatMessages,
      userStats,
    ] = await Promise.all([
      getAggregateFromServer(polls, {
        polls: aggregateCount(),
        votes: sum('totalVotes'),
      }),
      count(query(polls, where('listed', '==', true))),
      count(query(polls, where('ttl', '>', Timestamp.now()))),
      count(collection(this.fs, 'chatMessages')),
      // ordered so it runs on the collection group createdAt index
      count(query(this.messagesGroup, orderBy('createdAt', 'desc'))),
      this.api<UserStatsDto>('GET', 'user-stats'),
    ]);
    return {
      polls: pollTotals.data().polls,
      listedPolls,
      openPolls,
      votes: pollTotals.data().votes ?? 0,
      lobbyMessages,
      chatMessages,
      users: userStats.users,
      anonymousUsers: userStats.anonymous,
      admins: userStats.admins,
    };
  }

  public watchAllPolls(counts: Observable<number>): Observable<Page<Poll>> {
    return this.watchPages(
      query(this.pollsCol, orderBy('createdAt', 'desc')),
      counts
    );
  }

  public deletePoll(pollId: string): WriteReceipt {
    // the rules let admins delete any poll, the same way its creator does
    return this.pollsRepo.deletePoll(pollId);
  }

  public watchMessages(
    counts: Observable<number>
  ): Observable<Page<AdminChatMessage>> {
    return this.watchPages(
      query(this.messagesGroup, orderBy('createdAt', 'desc')),
      counts
    );
  }

  public deleteMessage({ id, pollId }: AdminChatMessage): WriteReceipt {
    const ref = pollId
      ? doc(this.fs, 'polls', pollId, 'chatMessages', id)
      : doc(this.fs, 'chatMessages', id);
    return { saved: deleteDoc(ref) };
  }

  public async loadUsers(pageToken?: string): Promise<UsersPage> {
    const page = await this.api<UsersPageDto>(
      'GET',
      pageToken ? `users?pageToken=${encodeURIComponent(pageToken)}` : 'users'
    );
    return {
      users: page.users.map(toAppUser),
      nextPageToken: page.nextPageToken,
    };
  }

  public async setAdmin(uid: string, isAdmin: boolean): Promise<AppUser> {
    const body: SetRoleDto = { uid, admin: isAdmin };
    return toAppUser(await this.api<AppUserDto>('POST', 'role', body));
  }

  public setFeature(flag: FeatureFlag, enabled: boolean): WriteReceipt {
    return {
      saved: setDoc(
        doc(this.fs, 'appConfig', 'features'),
        { [flag]: enabled },
        { merge: true }
      ),
    };
  }

  /** Calls the admin API with the visitor's sign-in token. */
  private async api<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: unknown
  ): Promise<T> {
    await this.auth.authStateReady();
    const idToken = await this.auth.currentUser?.getIdToken();
    if (!idToken) {
      throw new Error('Sign in first');
    }
    return firstValueFrom(
      this.http.request<T>(method, `/api/v1/admin/${path}`, {
        body,
        headers: { Authorization: `Bearer ${idToken}` },
      })
    );
  }

  /** Asks for one more than each count: whether it comes tells if there are more. */
  private watchPages<T>(
    items: Query<T>,
    counts: Observable<number>
  ): Observable<Page<T>> {
    return counts.pipe(
      switchMap((count) =>
        queryData(query(items, limit(count + 1))).pipe(
          map((found) => toPage(found, count))
        )
      )
    );
  }
}
