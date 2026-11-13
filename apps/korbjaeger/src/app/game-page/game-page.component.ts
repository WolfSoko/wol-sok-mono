import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
} from '@angular/core';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTableModule } from '@angular/material/table';
import { RouterLink } from '@angular/router';
import {
  parseDbbId,
  type Game,
  type Team,
  type TeamId,
} from '@wolsok/feat-shared-basketball-data';
import { SELECTION } from '../selection/selection';
import { gameDetailsResource } from '../basketball-data/game-details-resource';
import { gameReportResource } from '../basketball-data/game-report-resource';
import { errorText, NO_GAME } from '../errors/error-text';
import { VenueComponent } from '../venue/venue.component';
import { CHILD_CHANGE, provideChildChange } from '../child/child-change';
import { PROVISIONAL } from '../game/game-format';
import { RosterComponent } from './roster.component';
import { gameHead } from './game-head';
import { gameReportPart } from './game-report-part';
import { AsOfComponent } from '../as-of/as-of.component';
import { applyClubColors } from '../club-colors/apply-club-colors';
import { breadcrumb } from '../navigation/breadcrumb';
import { followedSide } from './followed-club';

/**
 * The Spiel page: the result and quarter scores, the Halle, and both
 * Kader of the Spielbericht, where a followed Team's Kader lets the
 * Elternteil mark their Kind. The Spiel and its Spielbericht are read,
 * load and fail on their own.
 */
@Component({
  selector: 'korb-game-page',
  imports: [
    VenueComponent,
    RosterComponent,
    MatProgressBarModule,
    MatTableModule,
    RouterLink,
    AsOfComponent,
  ],
  providers: [provideChildChange()],
  templateUrl: './game-page.component.html',
  styleUrl: './game-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GamePageComponent {
  /** The Spiel's DBB id, as the route gives it. */
  public readonly gameId = input.required<string>();

  private readonly game = computed(() => parseDbbId(this.gameId()));

  private readonly followed = inject(SELECTION).teams;

  /** What the page says when marking a Kind failed. */
  protected readonly childError = inject(CHILD_CHANGE).error;
  protected readonly provisionalText = PROVISIONAL;

  protected readonly details = gameDetailsResource(() => this.game());

  protected readonly report = gameReportResource(() => this.game());

  protected readonly head = computed(() =>
    this.details.hasValue() ? gameHead(this.details.value()) : undefined
  );

  /** Each period's column, then the final score's. */
  protected readonly periodColumns = computed(() => [
    'team',
    ...(this.head()?.periods?.columns.map((_, i) => `period-${i}`) ?? []),
    'total',
  ]);

  protected readonly error = computed(() =>
    this.game() === undefined
      ? NO_GAME
      : errorText(this.details.error(), NO_GAME)
  );

  protected readonly gameReport = computed(() =>
    this.game() === undefined
      ? undefined
      : gameReportPart(this.report, this.details, this.followed())
  );

  /**
   * The followed side's Team, whose colours the page wears (#2918) and
   * which its breadcrumb leads up to. While Meine Teams are read again (a
   * sign-in or sign-out switches stores), the last one stays, so the page
   * neither flashes the app's own colours nor loses its way up.
   */
  private readonly followedTeam = linkedSignal<
    { game: Game | undefined; followed: readonly TeamId[] | undefined },
    Team | undefined
  >({
    source: () => ({
      game: this.details.hasValue() ? this.details.value().game : undefined,
      followed: this.followed(),
    }),
    computation: ({ game, followed }, before) =>
      followed === undefined
        ? before?.value
        : game && followedSide(game, followed),
  });

  public constructor() {
    applyClubColors(() => this.followedTeam()?.clubId);
    breadcrumb(() => {
      const team = this.followedTeam();
      const gameLevel = { title: 'Spiel' };
      return team
        ? [{ title: team.name, link: ['/team', String(team.id)] }, gameLevel]
        : [gameLevel];
    });
  }
}
