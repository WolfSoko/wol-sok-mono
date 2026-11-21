import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { rgba } from '@wolsok/feat-bacteria-rendering';
import {
  type Avatar,
  getColonyColor,
  MATCH_LEVELS,
} from '@wolsok/feat-shared-bacteria-engine';
import { I18nService } from '../i18n/i18n.service';
import type { TranslationKey } from '../i18n/game-texts';
import { TranslatePipe } from '../i18n/translate.pipe';
import { GuestRoom } from '../net/guest-room';
import { RoomTally } from '../net/room-tally';
import { AvatarComponent } from '../social/avatar.component';
import { SocialService } from '../social/social.service';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { LevelCard, LevelCardComponent } from './level-card.component';
import { LevelPreviewComponent } from './level-preview.component';
import { LevelPreviewService } from './level-preview.service';
import { levelCard } from './menu-cards';

/** One player of the room, as the room shows them. */
export interface RoomPlayer {
  name: string;
  avatar: Avatar | null;
  /** True for the player at this device. */
  you: boolean;
  /** True to tag them as "You" - not when "You" is their name already. */
  youTag: boolean;
  /** Their colony's colour, as a CSS colour. */
  color: string;
  /** True for the winner of the match just played. */
  won: boolean;
  /** True for a guest who said ready. */
  ready: boolean;
}

/**
 * The room two connected players share, before the first match and between
 * matches: both players face to face with the room's tally, and the next
 * match's level. The host picks it here - every pick reaches the guest
 * through the setup the host already shares - and the guest watches it
 * change. A guest whose host understands the room may wish a level and say
 * ready (`GuestRoom`), which the host sees; picking stays the host's, and
 * starting stays with the screen around it.
 */
@Component({
  selector: 'feat-lazy-bac-game-online-room',
  imports: [
    AvatarComponent,
    LevelCardComponent,
    LevelPreviewComponent,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
  ],
  templateUrl: './online-room.component.html',
  styleUrl: './online-room.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnlineRoomComponent {
  private readonly store = inject(GameStateStore);
  private readonly gameState = inject(GameStateService);
  private readonly social = inject(SocialService);
  private readonly i18n = inject(I18nService);
  private readonly guestRoom = inject(GuestRoom);
  protected readonly previews = inject(LevelPreviewService).supported;
  protected readonly tally = inject(RoomTally).tally;

  /** The seat of the match just won, on a result - null before one. */
  public readonly winner = input<0 | 1 | null>(null);

  /** This device's online seat - null without a connection. */
  protected readonly seat = this.store.online;

  /** The guest's wish and ready, on either seat. */
  protected readonly guest = this.guestRoom.state;

  /** True on the host's device, which picks and starts. */
  protected readonly isHost = computed(() => this.seat()?.seat === 0);

  /** True for a guest who may wish a level and say ready. */
  protected readonly guestSpeaks = computed(
    () => this.seat()?.seat === 1 && this.guestRoom.available()
  );

  /** The opponent's name, once their profile is there. */
  private readonly opponentName = computed(
    () => this.social.opponent()?.card.name
  );

  /** The host (left) and the guest (right). */
  protected readonly players = computed((): RoomPlayer[] => {
    const seat = this.seat();
    if (seat === null) {
      return [];
    }
    const own = this.social.profile();
    const opponent = this.social.opponent()?.card ?? null;
    const me = {
      name: own?.name ?? this.i18n.t('online.room.you'),
      avatar: own?.avatar ?? null,
    };
    const them = {
      name: opponent?.name ?? this.i18n.t('newGame.opponent'),
      avatar: opponent?.avatar ?? null,
    };
    return ([0, 1] as const).map((index) => {
      const you = index === seat.seat;
      return {
        ...(you ? me : them),
        you,
        youTag: you && own !== null,
        color: cssColor(seat.colors[index]),
        won: this.winner() === index,
        ready: index === 1 && this.guest().ready,
      };
    });
  });

  /** The level of the next match. */
  protected readonly next = computed(() => {
    const levelId = this.seat()?.levelId;
    return levelId === undefined ? null : this.card(levelId);
  });

  /** The levels the host may pick from. */
  protected readonly cards = computed(() =>
    MATCH_LEVELS.map((level) => this.card(level.id))
  );

  /** What the guest reads while the host picks. */
  protected readonly choosing = computed(() =>
    this.byOpponent('online.room.choosing', 'online.room.choosingAnon')
  );

  /** The tag on the wished level's card: whose wish it is. */
  protected readonly wishTag = computed(() =>
    !this.isHost()
      ? this.i18n.t('online.room.yourWish')
      : this.byOpponent('online.room.wants', 'online.room.wantsAnon')
  );

  /** What the host reads of the guest's wish - null without one. */
  protected readonly suggests = computed(() => {
    const wish = this.guest().wish;
    if (!this.isHost() || wish === null) {
      return null;
    }
    const level = this.card(wish).title;
    return this.byOpponent('online.room.suggests', 'online.room.suggestsAnon', {
      level,
    });
  });

  /** The host picks the level; the guest wishes it. */
  protected pick(levelId: string): void {
    if (this.isHost()) {
      this.gameState.setLevel(levelId);
    } else if (this.guestSpeaks()) {
      this.guestRoom.suggest(levelId);
    }
  }

  protected toggleReady(): void {
    this.guestRoom.toggleReady();
  }

  /** A text naming the opponent - its `anon` form without their profile. */
  private byOpponent(
    named: TranslationKey,
    anon: TranslationKey,
    params: Record<string, string> = {}
  ): string {
    const name = this.opponentName();
    return name === undefined
      ? this.i18n.t(anon, params)
      : this.i18n.t(named, { ...params, name });
  }

  private card(id: string): LevelCard {
    return levelCard(id, (key, params) => this.i18n.t(key, params));
  }
}

function cssColor(colorId: string): string {
  return rgba(getColonyColor(colorId).rgb);
}
