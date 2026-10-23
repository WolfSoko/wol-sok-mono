import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatchmakerService } from '../net/matchmaker.service';
import type { OnlineLobby } from '../net/online-match.service';
import { AvatarComponent } from '../social/avatar.component';
import { FriendsComponent } from '../social/friends.component';
import { SocialService } from '../social/social.service';
import { CODE_LENGTH } from '../storage/game-rooms';

/**
 * The lobby of online matches: find an opponent automatically, challenge a
 * friend who is online, or open a room and pass its code on - or join one
 * with its code. The code part reports what the player picks; finding an
 * opponent and challenging a friend it runs itself.
 */
@Component({
  selector: 'feat-lazy-bac-game-online-lobby',
  imports: [
    AvatarComponent,
    FriendsComponent,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
  ],
  templateUrl: './online-lobby.component.html',
  styleUrl: './online-lobby.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineLobbyComponent {
  protected readonly matchmaker = inject(MatchmakerService);
  protected readonly social = inject(SocialService);

  public readonly lobby = input.required<OnlineLobby>();
  /** False without the cloud or a browser that connects devices directly. */
  public readonly available = input(true);
  /** The names of the host's and the guest's colony. */
  public readonly colonyNames = input<readonly [string, string]>([
    'Left',
    'Right',
  ]);

  public readonly host = output<void>();
  public readonly join = output<string>();
  public readonly leave = output<void>();

  protected readonly codeLength = CODE_LENGTH;
  /** The code typed in so far. */
  protected readonly typed = signal('');

  /** The colony the player at this device steers, once connected. */
  protected readonly ownColony = computed(() => {
    const { role } = this.lobby();
    return role === null ? null : this.colonyNames()[role === 'host' ? 0 : 1];
  });

  /** Leaves the room, the match or the search - and takes a challenge back. */
  protected cancel(): void {
    this.social.cancelChallenge();
    if (this.matchmaker.state() !== 'idle') {
      void this.matchmaker.cancel();
    }
    this.leave.emit();
  }

  protected type(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.join.emit(this.typed());
  }
}
