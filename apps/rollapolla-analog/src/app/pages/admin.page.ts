import { isPlatformServer } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { isGoogleAccount } from '../../shared/account';
import { AccountAction } from '../core/account/account-action';
import { AdminFeaturesComponent } from '../core/admin/admin-features.component';
import { AdminMessagesComponent } from '../core/admin/admin-messages.component';
import { AdminPollsComponent } from '../core/admin/admin-polls.component';
import { AdminStatsComponent } from '../core/admin/admin-stats.component';
import { AdminUsersComponent } from '../core/admin/admin-users.component';
import { AccountPort } from '../ports/account.port';
import { AdminPort } from '../ports/admin.port';
import { useNoindexPage } from './site-tags';

type Access = 'loading' | 'signed-out' | 'denied' | 'admin';

@Component({
  selector: 'rap-admin-page',
  imports: [
    AdminFeaturesComponent,
    AdminMessagesComponent,
    AdminPollsComponent,
    AdminStatsComponent,
    AdminUsersComponent,
    MatButtonModule,
    MatCardModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTabsModule,
  ],
  template: `
    <main class="rap-container main">
      <h1>Admin</h1>
      @switch (access()) {
        @case ('admin') {
          <mat-tab-group dynamicHeight preserveContent data-testid="admin-tabs">
            <mat-tab label="Statistics">
              <ng-template matTabContent><rap-admin-stats /></ng-template>
            </mat-tab>
            <mat-tab label="Polls">
              <ng-template matTabContent><rap-admin-polls /></ng-template>
            </mat-tab>
            <mat-tab label="Messages">
              <ng-template matTabContent><rap-admin-messages /></ng-template>
            </mat-tab>
            <mat-tab label="Users">
              <ng-template matTabContent><rap-admin-users /></ng-template>
            </mat-tab>
            <mat-tab label="Features">
              <ng-template matTabContent><rap-admin-features /></ng-template>
            </mat-tab>
          </mat-tab-group>
        }
        @case ('signed-out') {
          <mat-card
            appearance="outlined"
            class="notice"
            data-testid="admin-signed-out"
          >
            <mat-icon class="notice-icon" aria-hidden="true">lock</mat-icon>
            <mat-card-header>
              <mat-card-title>Admins only</mat-card-title>
              <mat-card-subtitle>
                Sign in with your Google account to continue.
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button
                mat-flat-button
                type="button"
                [disabled]="action.busy()"
                (click)="signIn()"
              >
                <mat-icon>login</mat-icon>
                Sign in with Google
              </button>
            </mat-card-actions>
          </mat-card>
        }
        @case ('denied') {
          <mat-card
            appearance="outlined"
            class="notice"
            data-testid="admin-denied"
          >
            <mat-icon class="notice-icon" aria-hidden="true">block</mat-icon>
            <mat-card-header>
              <mat-card-title>No access</mat-card-title>
              <mat-card-subtitle>
                This account is not an admin. An admin can grant access to user
                id <code data-testid="admin-own-uid">{{ uid() }}</code
                >; the first admin is granted with the
                <code>grant-admin</code> script.
              </mat-card-subtitle>
            </mat-card-header>
            <mat-card-actions>
              <button
                mat-button
                type="button"
                [disabled]="action.busy()"
                (click)="recheck()"
                data-testid="admin-recheck"
              >
                <mat-icon>refresh</mat-icon>
                Check again
              </button>
            </mat-card-actions>
          </mat-card>
        }
        @default {
          <mat-spinner class="spinner" diameter="40" />
        }
      }
    </main>
  `,
  styles: `
    .main {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-width: 960px;
      padding-block: clamp(1.5rem, 5vw, 3rem) 0;
    }
    h1 {
      margin: 0;
      font: var(--mat-sys-headline-medium);
    }
    .spinner {
      align-self: center;
      margin-block: 3rem;
    }
    .notice {
      align-items: center;
      gap: 0.5rem;
      padding: 2.5rem 1rem 1.5rem;
      text-align: center;
    }
    .notice-icon {
      width: 3rem;
      height: 3rem;
      font-size: 3rem;
      color: var(--mat-sys-on-surface-variant);
    }
    code {
      overflow-wrap: anywhere;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export default class AdminPageComponent {
  private readonly accountPort = inject(AccountPort);
  private readonly isServer = isPlatformServer(inject(PLATFORM_ID));
  private readonly account = toSignal(this.accountPort.account$);
  private readonly admin = inject(AdminPort);
  private readonly isAdmin = toSignal(this.admin.isAdmin$);
  protected readonly action = new AccountAction();

  protected readonly uid = computed(() => this.account()?.uid);

  /** The server knows nobody, so it renders the spinner, like the browser at first. */
  protected readonly access = computed((): Access => {
    const account = this.account();
    if (this.isServer || account === undefined) {
      return 'loading';
    }
    if (!isGoogleAccount(account)) {
      return 'signed-out';
    }
    const isAdmin = this.isAdmin();
    if (isAdmin === undefined) {
      return 'loading';
    }
    return isAdmin ? 'admin' : 'denied';
  });

  constructor() {
    useNoindexPage('Admin | RollaPolla', '/admin');
    if (!this.isServer) {
      // rights granted or revoked in the last hour apply right away here
      void this.admin
        .recheckAdmin()
        .catch((error: unknown) =>
          console.error('Could not recheck the admin rights', error)
        );
    }
  }

  protected recheck(): Promise<void> {
    return this.action.run(() => this.admin.recheckAdmin());
  }

  protected signIn(): Promise<void> {
    return this.action.run(() => this.accountPort.signInWithGoogle());
  }
}
