import {
  DbbBasketballData,
  type TeamSeason,
} from '@wolsok/feat-shared-basketball-data';
import { recordedDbbTransport } from '@wolsok/feat-shared-basketball-data/testing';
import { spielZeilen } from './spiel-zeile';

const RECORDED = new DbbBasketballData(recordedDbbTransport);

/** FC Bayern München Basketball: BBL and BBL-Pokal, none confirmed. */
const BBL_TEAM = 163073;
/** MTV Wasbüttel's U12 Team: four Spiele whose results wait for the Verband. */
const YOUTH_TEAM = 313036;

/** The lines of the recorded `season`'s played Spiele. */
function playedLines(season: TeamSeason) {
  return spielZeilen(season).filter((line) => line.ergebnis !== undefined);
}

describe('spielZeilen on recorded Saisons', () => {
  it('shows every result of a BBL Team as final, which the DBB never confirms', async () => {
    const lines = playedLines(await RECORDED.teamGames(BBL_TEAM));

    expect(lines.length).toBeGreaterThan(0);
    expect(lines.filter((line) => line.vorlaeufig)).toEqual([]);
  });

  it('still marks a youth Team’s results the Verband has not confirmed yet', async () => {
    const lines = playedLines(await RECORDED.teamGames(YOUTH_TEAM));

    expect(
      lines.filter((line) => line.vorlaeufig).map((line) => line.id)
    ).toEqual([2861436, 2861439, 2861443, 2861445]);
  });
});
