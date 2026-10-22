import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { GameAccount } from '../storage/game-account';

/**
 * Where the progress is kept, and the way to sign in to keep it on every
 * device - or out again. Without the cloud it is kept on this device.
 */
@Component({
  selector: 'feat-lazy-bac-game-account',
  imports: [MatButtonModule, MatIconModule],
  template: `
    @if (!account.cloud) {
      <span class="note">Kept on this device</span>
    } @else {
      @let player = account.profile();
      @if (player === null) {
        <span class="note">Connecting…</span>
      } @else if (player.guest) {
        <span class="note">Playing as a guest</span>
        <button
          mat-stroked-button
          type="button"
          [disabled]="busy()"
          (click)="signIn()"
          title="Keep your progress on every device you sign in on"
        >
          <mat-icon>login</mat-icon>
          Sign in with Google
        </button>
      } @else {
        <span class="note">
          Signed in as <strong>{{ player.name ?? 'Google user' }}</strong>
        </span>
        <button
          mat-stroked-button
          type="button"
          [disabled]="busy()"
          (click)="signOut()"
        >
          <mat-icon>logout</mat-icon>
          Sign out
        </button>
      }
      @if (failed()) {
        <span class="failed" role="status">Sign-in failed - try again.</span>
      }
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
      gap: 0.5rem 0.75rem;
      margin-left: auto;
    }

    .note {
      font-size: 0.9rem;
      color: var(--bw-muted);

      strong {
        color: var(--bw-text);
      }
    }

    .failed {
      flex-basis: 100%;
      text-align: right;
      font-size: 0.85rem;
      color: var(--bw-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AccountComponent {
  protected readonly account = inject(GameAccount);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async signIn(): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    const outcome = await this.account.signIn();
    this.failed.set(outcome === 'failed');
    this.busy.set(false);
  }

  protected async signOut(): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    await this.account.signOut();
    this.busy.set(false);
  }
}
