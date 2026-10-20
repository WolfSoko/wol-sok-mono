/** Today's daily level as the menus show it. */
export interface DailyCard {
  name: string;
  /** Attempts left and the streak, in a line. */
  note: string;
}

/** The line under an endless run on the menus - the best run, once there is one. */
export function endlessNote(best: number): string {
  return best > 0
    ? `Generated levels, harder with every win · best ${best}`
    : 'Generated levels, harder with every win - three lives';
}
