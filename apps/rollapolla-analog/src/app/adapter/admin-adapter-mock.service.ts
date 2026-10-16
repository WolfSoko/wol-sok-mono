import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
  toPage,
  UsersPage,
} from '../../shared/admin';
import { FeatureFlag, FeatureToggles } from '../../shared/app-config';
import { Poll } from '../../shared/poll';
import { AdminPort } from '../ports/admin.port';
import { WriteReceipt } from '../ports/polls-repo.port';

@Injectable()
export class AdminAdapterMock extends AdminPort {
  public readonly isAdmin$ = new BehaviorSubject(false);
  public readonly polls$ = new BehaviorSubject<Poll[]>([]);
  public readonly messages$ = new BehaviorSubject<AdminChatMessage[]>([]);
  public readonly users$ = new BehaviorSubject<AppUser[]>([]);
  /** What `setFeature` stored, flag by flag. */
  public readonly features: Partial<FeatureToggles> = {};
  public stats: AdminStats = {
    polls: 0,
    listedPolls: 0,
    openPolls: 0,
    votes: 0,
    lobbyMessages: 0,
    chatMessages: 0,
    users: 0,
    anonymousUsers: 0,
    admins: 0,
  };
  /** Users per page in `loadUsers`. */
  public usersPageSize = 1000;
  /** Set to make the next writes fail on the backend. */
  public failWrites = false;

  public async loadStats(): Promise<AdminStats> {
    return this.stats;
  }

  public watchAllPolls(counts: Observable<number>): Observable<Page<Poll>> {
    return page(this.polls$, counts);
  }

  public deletePoll(pollId: string): WriteReceipt {
    return this.write(() =>
      this.polls$.next(this.polls$.value.filter((poll) => poll.id !== pollId))
    );
  }

  public watchMessages(
    counts: Observable<number>
  ): Observable<Page<AdminChatMessage>> {
    return page(this.messages$, counts);
  }

  public deleteMessage(message: AdminChatMessage): WriteReceipt {
    return this.write(() =>
      this.messages$.next(
        this.messages$.value.filter(
          ({ id, pollId }) => id !== message.id || pollId !== message.pollId
        )
      )
    );
  }

  public async recheckAdmin(): Promise<void> {
    this.rechecks++;
  }
  /** How often `recheckAdmin` was called. */
  public rechecks = 0;

  public async loadUsers(pageToken?: string): Promise<UsersPage> {
    const start = Number(pageToken ?? 0);
    const end = start + this.usersPageSize;
    return {
      users: this.users$.value.slice(start, end),
      nextPageToken: end < this.users$.value.length ? String(end) : null,
    };
  }

  public async setAdmin(uid: string, isAdmin: boolean): Promise<AppUser> {
    if (this.failWrites) {
      throw new Error('permission-denied');
    }
    const users = this.users$.value.map((user) =>
      user.uid === uid ? { ...user, isAdmin } : user
    );
    this.users$.next(users);
    const updated = users.find((user) => user.uid === uid);
    if (!updated) {
      throw new Error('No such user');
    }
    return updated;
  }

  public setFeature(flag: FeatureFlag, enabled: boolean): WriteReceipt {
    return this.write(() => {
      this.features[flag] = enabled;
    });
  }

  private write(apply: () => void): WriteReceipt {
    if (this.failWrites) {
      return { saved: Promise.reject(new Error('permission-denied')) };
    }
    apply();
    return { saved: Promise.resolve() };
  }
}

function page<T>(
  items$: Observable<T[]>,
  counts: Observable<number>
): Observable<Page<T>> {
  return combineLatest([items$, counts]).pipe(
    map(([items, count]) => toPage(items, count))
  );
}
