import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import type { TeamId } from '@wolsok/feat-shared-basketball-data';
import { AUSWAHL } from '../auswahl/auswahl';
import { auswahlFehlerText } from '../fehler/auswahl-fehler-text';

/** How long the offer to undo stays, long enough to read and tap it. */
const RUECKGAENGIG_MS = 8000;

/**
 * Offers to undo the unfollowing of a Team, where the control that
 * unfollowed it goes with it (a card of the overview): a snackbar,
 * which outlives the control, saying the Team is gone from Meine Teams,
 * with "Rückgängig" to follow it again; a failed undo says why there.
 * Call in an injection context; the function it returns, once the
 * Team is unfollowed.
 */
export function injectEntfolgenRueckgaengig(): (
  team: TeamId,
  name: string
) => void {
  const snackBar = inject(MatSnackBar);
  const auswahl = inject(AUSWAHL);
  return (team, name) => {
    snackBar
      .open(`${name} steht nicht mehr in Meine Teams.`, 'Rückgängig', {
        duration: RUECKGAENGIG_MS,
      })
      .onAction()
      .subscribe(() => {
        auswahl.folgen(team).catch((grund: unknown) => {
          snackBar.open(auswahlFehlerText(grund), 'Schließen', {
            duration: RUECKGAENGIG_MS,
          });
        });
      });
  };
}
