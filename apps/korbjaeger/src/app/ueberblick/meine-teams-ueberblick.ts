import {
  computed,
  DestroyRef,
  effect,
  inject,
  Injectable,
  Injector,
  signal,
  untracked,
} from '@angular/core';
import type {
  PersonId,
  TeamId,
  VereinId,
  VereinsTeams,
} from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import type { DatenResource } from '../basketball-data/basketball-data-resource';
import { vereinsTeamsResource } from '../basketball-data/vereins-teams-resource';
import { gleicheFolge } from '../gleiche-folge';
import { HEUTE } from '../heute';
import { abgleichen } from './abgleichen';
import { teamImUeberblick } from './team-im-ueberblick';
import {
  lesungenBeenden,
  teamLesungen,
  type TeamLesungen,
} from './team-lesungen';
import {
  ueberblickAnsicht,
  type UeberblickAnsicht,
} from './ueberblick-ansicht';

/**
 * The overview's data: per followed Team its reads (`teamLesungen`), and
 * the Teams of each Verein one of them suggests from (one read per
 * Verein, however many of its Teams look done). A Team followed is read
 * once; one unfollowed has its reads cancelled and dropped, the others'
 * stay as they are (`abgleichen`).
 */
@Injectable()
export class MeineTeamsUeberblick {
  private readonly auswahl = inject(AUSWAHL);
  /** Whether Meine Teams and the Kinder cannot be read: no overview then. */
  public readonly nichtLesbar = this.auswahl.nichtLesbar;
  /** The marked Kinder's persons: a new Spitzname starts no search. */
  private readonly kinderPersonen = computed<readonly PersonId[]>(
    () => (this.auswahl.kinder() ?? []).map(({ personId }) => personId),
    { equal: gleicheFolge }
  );
  private readonly heute = inject(HEUTE);
  private readonly injector = inject(Injector);
  private readonly lesungen = signal<ReadonlyMap<TeamId, TeamLesungen>>(
    new Map()
  );
  private readonly vereinsLesungen = signal<
    ReadonlyMap<VereinId, DatenResource<VereinsTeams | undefined>>
  >(new Map());

  /** The Vereine to suggest Teams from: of each Team whose Saison looks over. */
  private readonly gesuchteVereine = computed(
    () =>
      new Set(
        [...this.lesungen().values()]
          .map((lesung) => lesung.saisonEndeVerein())
          .filter((verein): verein is VereinId => verein !== undefined)
      )
  );

  /**
   * The overview: each marked Kind with the Teams it plays for, and the
   * other Teams as cards (`ueberblickAnsicht`). `undefined` until Meine
   * Teams and the Kinder are read.
   */
  public readonly ansicht = computed<UeberblickAnsicht | undefined>(() => {
    const teams = this.auswahl.teams();
    const kinder = this.auswahl.kinder();
    if (teams === undefined || kinder === undefined) {
      return undefined;
    }
    const imUeberblick = teams.map((teamId) =>
      teamImUeberblick(
        teamId,
        this.lesungen().get(teamId),
        (verein) => this.vereinsLesungen().get(verein),
        kinder.length > 0
      )
    );
    return ueberblickAnsicht(kinder, imUeberblick, this.heute());
  });

  public constructor() {
    const umgebung = {
      heute: this.heute,
      kinder: this.kinderPersonen,
      injector: this.injector,
    };
    effect(() => {
      const teams = this.auswahl.teams() ?? [];
      untracked(() =>
        this.lesungen.update((vorher) =>
          abgleichen(
            vorher,
            teams,
            (teamId) => teamLesungen(teamId, umgebung),
            lesungenBeenden
          )
        )
      );
    });
    effect(() => {
      const vereine = this.gesuchteVereine();
      untracked(() =>
        this.vereinsLesungen.update((vorher) =>
          abgleichen(
            vorher,
            vereine,
            (verein) => vereinsTeamsResource(() => verein, this.injector),
            (read) => read.destroy()
          )
        )
      );
    });
    inject(DestroyRef).onDestroy(() => {
      this.lesungen().forEach(lesungenBeenden);
      this.vereinsLesungen().forEach((read) => read.destroy());
    });
  }
}
