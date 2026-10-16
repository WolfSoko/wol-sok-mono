import { Injectable } from '@angular/core';
import { BehaviorSubject, combineLatest, map, Observable } from 'rxjs';
import {
  AdminChatMessage,
  AdminStats,
  AppUser,
  Page,
  toPage,
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
    admins: 0,
  };
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

  public watchUsers(counts: Observable<number>): Observable<Page<AppUser>> {
    return page(this.users$, counts);
  }

  public setAdmin(uid: string, isAdmin: boolean): WriteReceipt {
    return this.write(() =>
      this.users$.next(
        this.users$.value.map((user) =>
          user.uid === uid ? { ...user, isAdmin } : user
        )
      )
    );
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
