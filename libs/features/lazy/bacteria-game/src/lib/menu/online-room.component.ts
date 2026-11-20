import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import {
  type Avatar,
  getColonyColor,
  getLevel,
  LEVELS,
  levelSize,
  levelTitleText,
  MATCH_LEVELS,
} from '@wolsok/feat-shared-bacteria-engine';
import { renderGameText, type GameText } from '../i18n/game-texts';
import { I18nService } from '../i18n/i18n.service';
import { TranslatePipe } from '../i18n/translate.pipe';
import { RoomTally } from '../net/room-tally';
import { AvatarComponent } from '../social/avatar.component';
import { SocialService } from '../social/social.service';
import { GameStateService } from '../state/game-state.service';
import { GameStateStore } from '../state/game.states';
import { LevelCard, LevelCardComponent } from './level-card.component';
import { LevelPreviewComponent } from './level-preview.component';
import { LevelPreviewService } from './level-preview.service';
import { levelColors } from './menu-cards';

/** One player of the room, as the room shows them. */
export interface RoomPlayer {
  name: string;
  avatar: Avatar | null;
  /** True for the player at this device. */
  you: boolean;
  /** Their colony's colour, as a CSS colour. */
  color: string;
  /** True for the winner of the match just played. */
  won: boolean;
}

/**
 * The room two connected players share, before the first match and between
 * matches: both players face to face with the room's tally, and the next
 * match's level. The host picks it here - every pick reaches the guest
 * through the setup the host already shares - and the guest watches it
 * change. Starting stays with the screen around it.
 */
@Component({
  selector: 'feat-lazy-bac-game-online-room',
  imports: [
    AvatarComponent,
    LevelCardComponent,
    LevelPreviewComponent,
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
  protected readonly previews = inject(LevelPreviewService).supported;
  protected readonly tally = inject(RoomTally).tally;

  /** The seat of the match just won, on a result - null before one. */
  public readonly winner = input<0 | 1 | null>(null);

  /** This device's online seat - null without a connection. */
  protected readonly seat = this.store.online;

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
      name: opponent?.name ?? this.i18n.t('online.room.opponent'),
      avatar: opponent?.avatar ?? null,
    };
    return ([0, 1] as const).map((index) => ({
      ...(index === seat.seat ? me : them),
      you: index === seat.seat,
      color: cssColor(seat.colors[index]),
      won: this.winner() === index,
    }));
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
  protected readonly choosing = computed(() => {
    const name = this.social.opponent()?.card.name;
    return name === undefined
      ? this.i18n.t('online.room.choosingAnon')
      : this.i18n.t('online.room.choosing', { name });
  });

  protected pick(levelId: string): void {
    if (this.seat()?.seat === 0) {
      this.gameState.setLevel(levelId);
    }
  }

  /**
   * A level's card: its place on the ladder, its title in the active
   * language and its arena's colours. Online there are no medallions and
   * no locks.
   */
  private card(id: string): LevelCard {
    const level = getLevel(id);
    return {
      id: level.id,
      badge: String(LEVELS.indexOf(level) + 1),
      title: this.text(levelTitleText(level)),
      lock: null,
      ...levelColors(level.id),
      size: levelSize(level),
      medals: [],
    };
  }

  private text(text: GameText): string {
    return renderGameText(text, (key, params) => this.i18n.t(key, params));
  }
}

function cssColor(colorId: string): string {
  const [r, g, b] = getColonyColor(colorId).rgb;
  return `rgb(${r} ${g} ${b})`;
}
