import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { ProgressService } from '../progress.service';
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
          [disabled]="busy() || !progress.loaded()"
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
        <span class="failed" role="status">That did not work - try again.</span>
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
  /**
   * The guest's progress has to be here before a sign-in: an account that
   * played elsewhere adopts what the guest has, and the guest's stored
   * progress is out of reach once the account has taken over.
   */
  protected readonly progress = inject(ProgressService);
  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  protected async signIn(): Promise<void> {
    await this.whileBusy(async () => {
      this.failed.set((await this.account.signIn()) === 'failed');
    });
  }

  protected async signOut(): Promise<void> {
    await this.whileBusy(() => this.account.signOut());
  }

  private async whileBusy(task: () => Promise<void>): Promise<void> {
    this.busy.set(true);
    this.failed.set(false);
    try {
      await task();
    } catch (error) {
      console.error(error);
      this.failed.set(true);
    } finally {
      this.busy.set(false);
    }
  }
}
