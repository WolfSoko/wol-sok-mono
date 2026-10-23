import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { of, switchMap } from 'rxjs';
import { AvatarComponent } from './avatar.component';
import { ChallengeView, SocialService } from './social.service';

/** An invitation link someone opened: its token and who made it. */
export interface InviteOffer {
  token: string;
  from: string;
}

/**
 * What other players want from the player while they are in the menus: a
 * friend's challenge to a match, the invitation they opened by a link.
 */
@Component({
  selector: 'feat-lazy-bac-game-social-notices',
  imports: [AvatarComponent, MatButtonModule, MatIconModule],
  template: `
    @if (challenge(); as call) {
      <div class="notice" role="alert">
        <feat-lazy-bac-game-avatar
          [avatar]="call.card.avatar"
          [label]="call.card.name"
        />
        <span class="text"
          ><strong>{{ call.card.name }}</strong> challenges you to a
          match!</span
        >
        <button
          mat-flat-button
          type="button"
          [disabled]="busy()"
          (click)="acceptChallenge(call)"
        >
          Play
        </button>
        <button
          mat-icon-button
          type="button"
          aria-label="Decline"
          [disabled]="busy()"
          (click)="declineChallenge(call)"
        >
          <mat-icon>close</mat-icon>
        </button>
      </div>
    }
    @if (invite() !== null) {
      @if (inviter(); as card) {
        <div class="notice" role="alert">
          <feat-lazy-bac-game-avatar
            [avatar]="card.avatar"
            [label]="card.name"
          />
          <span class="text"
            >Add <strong>{{ card.name }}</strong> as a friend?</span
          >
          <button
            mat-flat-button
            type="button"
            [disabled]="busy()"
            (click)="acceptInvite()"
          >
            Add friend
          </button>
          <button
            mat-icon-button
            type="button"
            aria-label="Dismiss"
            [disabled]="busy()"
            (click)="inviteDone.emit()"
          >
            <mat-icon>close</mat-icon>
          </button>
        </div>
      }
    }
    @if (failed()) {
      <p class="failed" role="status">That did not work - try again.</p>
    }
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }

    .notice {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      padding: 0.6rem 0.75rem;
      border: 1px solid var(--bw-gold);
      border-radius: 1rem;
      background: var(--bw-surface-glass);
      color: var(--bw-text);
      pointer-events: auto;
    }

    .text {
      flex: 1 1 auto;
    }

    .failed {
      margin: 0;
      color: var(--bw-gold);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SocialNoticesComponent {
  private readonly social = inject(SocialService);

  /** An invitation link opened on this visit, null without one. */
  public readonly invite = input<InviteOffer | null>(null);
  /** False while the player cannot take a challenge - in a match or lobby. */
  public readonly canPlay = input(true);
  /** The player took a challenge: joining the room is the host's part. */
  public readonly play = output<ChallengeView>();
  /** The invitation is answered, either way. */
  public readonly inviteDone = output<void>();

  protected readonly busy = signal(false);
  protected readonly failed = signal(false);

  /** The newest challenge, while the player can take one. */
  protected readonly challenge = computed(() => {
    const challenges = this.social.challenges();
    return this.canPlay() ? (challenges.at(-1) ?? null) : null;
  });

  protected readonly inviter = toSignal(
    toObservable(this.invite).pipe(
      switchMap((offer) =>
        offer === null ? of(null) : this.social.card(offer.from)
      )
    ),
    { initialValue: null }
  );

  protected async acceptChallenge(call: ChallengeView): Promise<void> {
    await this.run(async () => {
      await this.social.clearChallenge(call.uid);
      this.play.emit(call);
    });
  }

  protected async declineChallenge(call: ChallengeView): Promise<void> {
    await this.run(() => this.social.clearChallenge(call.uid));
  }

  protected async acceptInvite(): Promise<void> {
    const offer = this.invite();
    if (offer !== null) {
      await this.run(async () => {
        await this.social.acceptInvite(offer.token, offer.from);
        this.inviteDone.emit();
      });
    }
  }

  private async run(task: () => Promise<void>): Promise<void> {
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
