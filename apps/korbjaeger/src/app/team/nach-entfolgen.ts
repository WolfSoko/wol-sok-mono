import { effect, inject, Injectable, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import type { TeamPlace } from '@wolsok/feat-korbjaeger-selection';
import { selectionErrorText } from '../errors/selection-error-text';

/** How long the offer to undo stays, long enough to read and tap it. */
const RUECKGAENGIG_MS = 8000;

/** An element focus may go to: for one Team, or (`undefined`) the screen. */
export interface FokusZiel {
  readonly element: HTMLElement;
  team(): TeamId | undefined;
}

/**
 * Provided by a screen whose follow controls disappear with the Team they
 * unfollow (an overview card, a followed row of the wizard); screens whose
 * control stays (the Team page, a Verein's Teams) provide none. Once a
 * control unfollowed a Team (`entfolgt`), focus moves to what stays: the
 * element marked `korbFokusNachEntfolgen` for that Team, else the one for
 * the screen; and a snackbar, which outlives the control, offers
 * "Rückgängig" to follow the Team again at the place it had, saying why
 * where that fails, as long as the same store holds the choices.
 */
@Injectable()
export class NachEntfolgen {
  private readonly snackBar = inject(MatSnackBar);
  private readonly auswahl = inject(AUSWAHL);
  private readonly injector = inject(Injector);
  private readonly ziele = new Set<FokusZiel>();

  /** Adds `ziel` until the returned function is called. */
  public zielSetzen(ziel: FokusZiel): () => void {
    this.ziele.add(ziel);
    return () => this.ziele.delete(ziel);
  }

  /**
   * A control unfollowed `team`, called `name`, and goes with it; `platz`
   * is the place it had (`Selection.unfollow`), where the undo puts it back.
   */
  public entfolgt(team: TeamId, name: string, platz?: TeamPlace): void {
    const ziele = [...this.ziele];
    const ziel =
      ziele.find((kandidat) => kandidat.team() === team) ??
      ziele.find((kandidat) => kandidat.team() === undefined);
    ziel?.element.focus();
    this.rueckgaengigAnbieten(team, name, platz);
  }

  /**
   * The snackbar with "Rückgängig", for the store the Team was unfollowed
   * in only: it goes once another holds the choices (`Selection.source`), so
   * the undo never follows in the wrong one.
   */
  private rueckgaengigAnbieten(
    team: TeamId,
    name: string,
    platz: TeamPlace | undefined
  ): void {
    const quelle = this.auswahl.source();
    const leiste = this.snackBar.open(
      `${name} steht nicht mehr in Meine Teams.`,
      'Rückgängig',
      { duration: RUECKGAENGIG_MS }
    );
    const wache = effect(
      () => {
        if (this.auswahl.source() !== quelle) {
          leiste.dismiss();
        }
      },
      { injector: this.injector }
    );
    leiste.afterDismissed().subscribe(() => wache.destroy());
    leiste.onAction().subscribe(() => {
      // the effect runs later: a tap right after a switch must not follow
      // in the other store
      if (this.auswahl.source() !== quelle) {
        return;
      }
      this.auswahl.follow(team, platz).catch((grund: unknown) => {
        this.snackBar.open(selectionErrorText(grund), 'Schließen', {
          duration: RUECKGAENGIG_MS,
        });
      });
    });
  }
}
