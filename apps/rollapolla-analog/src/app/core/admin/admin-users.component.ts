import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import {
  MatSlideToggleChange,
  MatSlideToggleModule,
} from '@angular/material/slide-toggle';
import { AppUser } from '../../../shared/admin';
import { AccountPort } from '../../ports/account.port';
import { AdminPort } from '../../ports/admin.port';
import { EndlessScroll } from '../endless-scroll/endless-scroll';
import { EndlessScrollEndComponent } from '../endless-scroll/endless-scroll-end.component';
import { AdminWrites } from './admin-writes';
import { endlessItems } from '../endless-scroll/endless-items';

/** Visitors who signed in with Google; admins grant and revoke admin rights. */
@Component({
  selector: 'rap-admin-users',
  imports: [
    DatePipe,
    EndlessScrollEndComponent,
    MatProgressSpinnerModule,
    MatSlideToggleModule,
  ],
  template: `
    <p class="lead">
      Everyone who signed in with Google, most recently seen first. Anonymous
      visitors are not listed.
    </p>
    @if (failed()) {
      <p class="error" role="alert" data-testid="admin-users-error">
        The users could not be loaded. Trying again…
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
                  {{ user.uid }} · last seen
                  {{ user.lastSeenAt | date: 'medium' }}
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
        <rap-endless-scroll-end [scroll]="scroll" />
      } @else {
        <p class="empty" data-testid="admin-users-empty">No users yet.</p>
      }
    } @else if (!failed()) {
      <mat-spinner class="spinner" diameter="40" />
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
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsersComponent {
  private readonly admin = inject(AdminPort);
  private readonly writes = new AdminWrites();
  private readonly account = toSignal(inject(AccountPort).account$);
  protected readonly scroll = new EndlessScroll();
  private readonly page = endlessItems(
    this.scroll,
    this.admin.watchUsers(this.scroll.counts),
    'Could not load the users'
  );
  protected readonly users = this.page.items;
  protected readonly failed = this.page.failed;

  protected readonly ownUid = computed(() => this.account()?.uid);

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
      () => this.admin.setAdmin(user.uid, checked),
      'The admin rights could not be changed.'
    );
    if (!saved) {
      source.checked = !checked;
    }
  }
}
