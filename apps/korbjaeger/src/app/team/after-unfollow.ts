import { effect, inject, Injectable, Injector } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { SELECTION } from '../selection/selection';
import type { TeamPlace } from '@wolsok/feat-korbjaeger-selection';
import { selectionErrorText } from '../errors/selection-error-text';

/** How long the offer to undo stays, long enough to read and tap it. */
const UNDO_MS = 8000;

/** An element focus may go to: for one Team, or (`undefined`) the screen. */
export interface FocusTarget {
  readonly element: HTMLElement;
  team(): TeamId | undefined;
}

/**
 * Provided by a screen whose follow controls disappear with the Team they
 * unfollow (an overview card, a followed row of the wizard); screens whose
 * control stays (the Team page, a Verein's Teams) provide none. Once a
 * control unfollowed a Team (`unfollowed`), focus moves to what stays: the
 * element marked `korbFocusAfterUnfollow` for that Team, else the one for
 * the screen; and a snackbar, which outlives the control, offers
 * "Rückgängig" to follow the Team again at the place it had, saying why
 * where that fails, as long as the same store holds the choices.
 */
@Injectable()
export class AfterUnfollow {
  private readonly snackBar = inject(MatSnackBar);
  private readonly selection = inject(SELECTION);
  private readonly injector = inject(Injector);
  private readonly targets = new Set<FocusTarget>();

  /** Adds `target` until the returned function is called. */
  public setTarget(target: FocusTarget): () => void {
    this.targets.add(target);
    return () => this.targets.delete(target);
  }

  /**
   * A control unfollowed `team`, called `name`, and goes with it; `place`
   * is the place it had (`Selection.unfollow`), where the undo puts it back.
   */
  public unfollowed(team: TeamId, name: string, place?: TeamPlace): void {
    const targets = [...this.targets];
    const target =
      targets.find((candidate) => candidate.team() === team) ??
      targets.find((candidate) => candidate.team() === undefined);
    target?.element.focus();
    this.offerUndo(team, name, place);
  }

  /**
   * The snackbar with "Rückgängig", for the store the Team was unfollowed
   * in only: it goes once another holds the choices (`Selection.source`), so
   * the undo never follows in the wrong one.
   */
  private offerUndo(
    team: TeamId,
    name: string,
    place: TeamPlace | undefined
  ): void {
    const source = this.selection.source();
    const bar = this.snackBar.open(
      `${name} steht nicht mehr in Meine Teams.`,
      'Rückgängig',
      { duration: UNDO_MS }
    );
    const guard = effect(
      () => {
        if (this.selection.source() !== source) {
          bar.dismiss();
        }
      },
      { injector: this.injector }
    );
    bar.afterDismissed().subscribe(() => guard.destroy());
    bar.onAction().subscribe(() => {
      // the effect runs later: a tap right after a switch must not follow
      // in the other store
      if (this.selection.source() !== source) {
        return;
      }
      this.selection.follow(team, place).catch((reason: unknown) => {
        this.snackBar.open(selectionErrorText(reason), 'Schließen', {
          duration: UNDO_MS,
        });
      });
    });
  }
}
