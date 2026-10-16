import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatSlideToggleChange,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { AppUser } from '../../../shared/admin';
import { AccountPort } from '../../ports/account.port';
import { AdminPort } from '../../ports/admin.port';
import { AdminWrites } from './admin-writes';

/**
 * The Firebase Auth users who signed in with Google; admins grant and revoke
 * the admin claim.
 */
@Component({
  selector: 'rap-admin-users',
  imports: [
    DatePipe,
    MatButtonModule,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  template: `
    <p class="lead">
      Everyone who signed in with Google. Anonymous visitors are not listed. New
      rights apply once the user's browser fetches a new sign-in token, within
      the hour.
    </p>
    @if (failed()) {
      <p class="error" role="alert" data-testid="admin-users-error">
        The users could not be loaded.
      </p>
    }
    @if (users(); as users) {
      @if (users.length) {
        <ul class="list" data-testid="admin-users">
          @for (user of users; track user.uid) {
            <li class="item" [attr.data-testid]="'admin-user-' + user.uid">
              @if (user.photoUrl) {
                <img
                  class="avatar"
                  [src]="user.photoUrl"
                  alt=""
                  width="36"
                  height="36"
                  referrerpolicy="no-referrer"
                />
              }
              <div class="body">
                <span class="title">{{ user.displayName ?? 'No name' }}</span>
                <span class="meta">
                  @if (user.email) {
                    {{ user.email }} ·
                  }
                  {{ user.uid }} · last sign-in
                  {{ (user.lastSignInAt | date: 'medium') ?? 'never' }}
                </span>
              </div>
              <mat-slide-toggle
                [checked]="user.isAdmin"
                [disabled]="user.uid === ownUid()"
                (change)="setAdmin(user, $event)"
                [title]="
                  user.uid === ownUid()
                    ? 'You cannot revoke your own admin rights'
                    : ''
                "
                data-testid="admin-toggle"
              >
                Admin
              </mat-slide-toggle>
            </li>
          }
        </ul>
      } @else if (!nextPageToken()) {
        <p class="empty" data-testid="admin-users-empty">No users yet.</p>
      }
    }
    @if (loading()) {
      <mat-spinner class="spinner" diameter="40" />
    } @else if (nextPageToken() || failed()) {
      <button
        mat-stroked-button
        type="button"
        class="more"
        (click)="loadMore()"
        data-testid="admin-users-more"
      >
        {{ failed() ? 'Try again' : 'Load more' }}
      </button>
    }
  `,
  styleUrl: './admin-list.scss',
  styles: `
    .item {
      padding-right: 1.25rem;
    }
    .avatar {
      border-radius: 50%;
    }
    .more {
      align-self: center;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminPort);
  private readonly writes = new AdminWrites();
  private readonly account = toSignal(inject(AccountPort).account$);
  /** `undefined` until the first page arrives. */
  protected readonly users = signal<AppUser[] | undefined>(undefined);
  /** Auth pages hold anonymous users too, so a page may add none. */
  protected readonly nextPageToken = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly failed = signal(false);

  protected readonly ownUid = computed(() => this.account()?.uid);

  constructor() {
    void this.loadMore();
  }

  protected async loadMore(): Promise<void> {
    this.loading.set(true);
    this.failed.set(false);
    try {
      const page = await this.admin.loadUsers(
        this.nextPageToken() ?? undefined
      );
      this.users.update((users) => [...(users ?? []), ...page.users]);
      this.nextPageToken.set(page.nextPageToken);
    } catch (error) {
      console.error('Could not load the users', error);
      this.failed.set(true);
    } finally {
      this.loading.set(false);
    }
  }

  protected async setAdmin(
    user: AppUser,
    { checked, source }: MatSlideToggleChange
  ): Promise<void> {
    const name = user.displayName ?? user.uid;
    const saved = await this.writes.confirmed(
      checked
        ? {
            title: 'Make an admin?',
            text: `${name} can then delete polls and messages, see all users and switch features.`,
            action: 'Make admin',
          }
        : {
            title: 'Revoke admin rights?',
            text: `${name} will no longer have access to the admin page.`,
            action: 'Revoke',
          },
      () => ({
        saved: this.admin
          .setAdmin(user.uid, checked)
          .then((updated) =>
            this.users.update((users) =>
              users?.map((listed) =>
                listed.uid === updated.uid ? updated : listed
              )
            )
          ),
      }),
      'The admin rights could not be changed.'
    );
    if (!saved) {
      source.checked = !checked;
    }
  }
}
