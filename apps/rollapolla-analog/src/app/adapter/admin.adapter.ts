import { isPlatformServer } from '@angular/common';
import { inject, Injectable, PLATFORM_ID } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
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
  serverTimestamp,
  setDoc,
  sum,
  Timestamp,
  where,
} from '@angular/fire/firestore';
import {
  catchError,
  combineLatest,
  distinctUntilChanged,
  map,
  Observable,
  of,
  shareReplay,
  switchMap,
} from 'rxjs';
import { isGoogleAccount } from '../../shared/account';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
  toPage,
} from '../../shared/admin';
import { FeatureFlag } from '../../shared/app-config';
import { ChatMessage } from '../../shared/chat.message';
import { Poll } from '../../shared/poll';
import { AdminPort } from '../ports/admin.port';
import { WriteReceipt } from '../ports/polls-repo.port';
import { chatMessageConverter } from './chat-message.converter';
import { ChatMessageDto } from './chat-message.dto';
import { pollConverter } from './poll.converter';
import { PollDto } from './poll.dto';
import { docSnapshots, queryData, querySnapshots } from './snapshots';
import { AdminGrantDto, UserDto } from './user.dto';

/** Lobby messages live in `chatMessages`, a poll's in `polls/{id}/chatMessages`. */
const adminMessageConverter: FirestoreDataConverter<
  AdminChatMessage,
  ChatMessageDto
> = {
  toFirestore: (message: AdminChatMessage) =>
    chatMessageConverter.toFirestore(message as ChatMessage),
  fromFirestore: (snapshot, options) => ({
    ...chatMessageConverter.fromFirestore(snapshot, options),
    pollId: snapshot.ref.parent.parent?.id ?? null,
  }),
};

type UserWithoutRole = Omit<AppUser, 'isAdmin'>;

const userConverter: FirestoreDataConverter<UserWithoutRole, UserDto> = {
  toFirestore: () => {
    throw new Error('Users record their own visits');
  },
  fromFirestore: (snapshot, options) => {
    const data = snapshot.data({
      ...options,
      serverTimestamps: 'estimate',
    }) as UserDto;
    return {
      uid: snapshot.id,
      displayName: data.displayName ?? null,
      photoUrl: data.photoUrl ?? null,
      lastSeenAt: data.lastSeenAt.toDate(),
    };
  },
};

@Injectable()
export class AdminAdapter extends AdminPort {
  private readonly fs: Firestore = inject(Firestore);
  private readonly auth: Auth = inject(Auth);
  private readonly pollsCol: CollectionReference<Poll, PollDto> = collection(
    this.fs,
    'polls'
  ).withConverter<Poll, PollDto>(pollConverter);
  private readonly messagesGroup: Query<AdminChatMessage, ChatMessageDto> =
    collectionGroup(this.fs, 'chatMessages').withConverter(
      adminMessageConverter
    );

  public readonly isAdmin$: Observable<boolean> = isPlatformServer(
    inject(PLATFORM_ID)
  )
    ? of(false)
    : authState(this.auth).pipe(
        switchMap((user) =>
          isGoogleAccount(user)
            ? docSnapshots(doc(this.fs, 'admins', user.uid)).pipe(
                map((grant) => grant.exists()),
                catchError(() => of(false))
              )
            : of(false)
        ),
        distinctUntilChanged(),
        shareReplay({ bufferSize: 1, refCount: true })
      );

  public async loadStats(): Promise<AdminStats> {
    const polls = collection(this.fs, 'polls');
    const count = async (counted: Query<unknown>): Promise<number> =>
      (await getCountFromServer(counted)).data().count;
    const [
      pollTotals,
      pollCount,
      listedPolls,
      openPolls,
      lobbyMessages,
      chatMessages,
      users,
      admins,
    ] = await Promise.all([
      getAggregateFromServer(polls, { votes: sum('totalVotes') }),
      count(polls),
      count(query(polls, where('listed', '==', true))),
      count(query(polls, where('ttl', '>', Timestamp.now()))),
      count(collection(this.fs, 'chatMessages')),
      // ordered so it runs on the collection group createdAt index
      count(query(this.messagesGroup, orderBy('createdAt', 'desc'))),
      count(collection(this.fs, 'users')),
      count(collection(this.fs, 'admins')),
    ]);
    return {
      polls: pollCount,
      listedPolls,
      openPolls,
      votes: pollTotals.data().votes ?? 0,
      lobbyMessages,
      chatMessages,
      users,
      admins,
    };
  }

  public watchAllPolls(counts: Observable<number>): Observable<Page<Poll>> {
    return this.watchPages(
      query(this.pollsCol, orderBy('createdAt', 'desc')),
      counts
    );
  }

  public deletePoll(pollId: string): WriteReceipt {
    return { saved: deleteDoc(doc(this.fs, 'polls', pollId)) };
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

  public watchUsers(counts: Observable<number>): Observable<Page<AppUser>> {
    const users = collection(this.fs, 'users').withConverter(userConverter);
    const adminUids$ = querySnapshots(collection(this.fs, 'admins')).pipe(
      map((snapshot) => new Set(snapshot.docs.map((grant) => grant.id)))
    );
    return combineLatest([
      this.watchPages(query(users, orderBy('lastSeenAt', 'desc')), counts),
      adminUids$,
    ]).pipe(
      map(([page, adminUids]) => ({
        ...page,
        items: page.items.map((user) => ({
          ...user,
          isAdmin: adminUids.has(user.uid),
        })),
      }))
    );
  }

  public setAdmin(uid: string, isAdmin: boolean): WriteReceipt {
    const grantRef = doc(this.fs, 'admins', uid);
    if (!isAdmin) {
      return { saved: deleteDoc(grantRef) };
    }
    const grant: AdminGrantDto = {
      grantedAt: serverTimestamp(),
      grantedBy: this.auth.currentUser?.uid ?? '',
    };
    return { saved: setDoc(grantRef, grant) };
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
