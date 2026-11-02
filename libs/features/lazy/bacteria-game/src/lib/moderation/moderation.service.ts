import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { of } from 'rxjs';
import { GameCloud } from '../storage/game-cloud';
import type { PlayerBan, PlayerNotice } from '../storage/game-moderation';

/**
 * The owner's moderation as the player meets it (ADR 0012): the ban holding
 * them, if any - which the banner tells and which takes away what the
 * rules' `notBanned()` refuses: online play, the profile, friends, uploads,
 * ranked attempts - and the notices the functions leave them. The port
 * (`GameCloud.moderation()`) listens only while a player is signed in and
 * ends a ban by itself at its `until`. Without the game's cloud nobody is
 * banned and nothing is told.
 */
@Injectable({ providedIn: 'root' })
export class ModerationService {
  private readonly moderation = inject(GameCloud).moderation();

  /** The ban holding the player, null while none does. */
  public readonly ban = toSignal(this.moderation?.ban() ?? of(null), {
    initialValue: null as PlayerBan | null,
  });

  /** True while a ban holds: the game offers nothing it would refuse. */
  public readonly banned = computed(() => this.ban() !== null);

  /** The notices the owner's actions left the player, oldest first. */
  public readonly notices = toSignal(this.moderation?.notices() ?? of([]), {
    initialValue: [] as PlayerNotice[],
  });

  /** Deletes a notice the player has read. */
  public async dismiss(id: string): Promise<void> {
    await this.moderation?.dismiss(id);
  }
}
