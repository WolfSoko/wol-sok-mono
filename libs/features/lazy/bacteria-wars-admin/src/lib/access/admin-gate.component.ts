import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { Router } from '@angular/router';
import { AdminTextPipe } from '../i18n/admin-i18n.service';
import { AdminAccessService } from './admin-access.service';

/** What the admin area shows to anybody the guard turned away. */
@Component({
  selector: 'feat-lazy-bac-admin-gate',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    AdminTextPipe,
    MatButtonModule,
    MatCardModule,
    MatProgressSpinnerModule,
  ],
  template: `
    <mat-card class="gate" appearance="outlined">
      <mat-card-content>
        @switch (access.access()) {
          @case ('checking') {
            <mat-spinner diameter="32" />
            <p>{{ 'gate.checking' | adminT }}</p>
          }
          @case ('no-project') {
            <p>{{ 'gate.noProject' | adminT }}</p>
          }
          @case ('signed-out') {
            <p>{{ 'gate.signedOut' | adminT }}</p>
          }
          @case ('no-access') {
            <p>{{ 'gate.noAccess' | adminT }}</p>
          }
        }
        @if (failed()) {
          <p class="failed" role="alert">{{ 'gate.failed' | adminT }}</p>
        }
      </mat-card-content>
      <mat-card-actions>
        @if (access.access() === 'signed-out') {
          <button mat-flat-button type="button" (click)="signIn()">
            {{ 'gate.signIn' | adminT }}
          </button>
        }
        @if (access.access() === 'no-access') {
          <button mat-stroked-button type="button" (click)="switchAccount()">
            {{ 'gate.signIn' | adminT }}
          </button>
        }
      </mat-card-actions>
    </mat-card>
  `,
  styles: `
    .gate {
      max-width: 28rem;
      margin: 3rem auto;
    }
    .failed {
      color: #ff8a80;
    }
  `,
})
export class AdminGateComponent {
  protected readonly access = inject(AdminAccessService);
  private readonly router = inject(Router);
  protected readonly failed = signal(false);

  public constructor() {
    void this.access.check();
  }

  protected async signIn(): Promise<void> {
    this.failed.set(false);
    if (!(await this.access.signIn())) {
      this.failed.set(true);
      return;
    }
    if (this.access.access() === 'granted') {
      // The guard runs again, now letting the views match.
      await this.router.navigateByUrl(this.router.url, {
        onSameUrlNavigation: 'reload',
      });
    }
  }

  protected async switchAccount(): Promise<void> {
    await this.access.signOut();
    await this.signIn();
  }
}
