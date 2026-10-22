import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  output,
  signal,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import type { OnlineLobby } from '../net/online-match.service';
import { CODE_LENGTH } from '../storage/game-rooms';

/**
 * The lobby of an online match: open a room and pass its code on, or join
 * a friend's room with theirs. A dumb component - it shows the lobby it is
 * given and reports what the player picks.
 */
@Component({
  selector: 'feat-lazy-bac-game-online-lobby',
  imports: [
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

  protected type(event: Event): void {
    this.typed.set((event.target as HTMLInputElement).value);
  }

  protected submit(event: Event): void {
    event.preventDefault();
    this.join.emit(this.typed());
  }
}
