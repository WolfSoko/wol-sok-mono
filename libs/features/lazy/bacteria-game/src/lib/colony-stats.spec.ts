import { sameColonyStats, toColonyStats } from './colony-stats';
import { createPlayer } from './state/player.model';

function players(bacteriaCount: number, x = 10) {
  return [
    createPlayer({
      id: 0,
      x,
      y: 10,
      color: [255, 100, 20, 255],
      name: 'You',
      isBot: false,
      maxSpeed: 100,
    }),
    createPlayer({
      id: 1,
      x: 200,
      y: 10,
      color: [20, 100, 255, 255],
      name: 'Computer',
      isBot: true,
      maxSpeed: 100,
    }),
  ].map((player) => ({ ...player, bacteriaCount }));
}

describe('sameColonyStats', () => {
  it('ignores what the scoreboard does not show - a moving crosshair', () => {
    expect(
      sameColonyStats(
        toColonyStats(players(50, 10)),
        toColonyStats(players(50, 90))
      )
    ).toBe(true);
  });

  it('notices a number that changed', () => {
    expect(
      sameColonyStats(toColonyStats(players(50)), toColonyStats(players(51)))
    ).toBe(false);
  });

  it('notices a colony more or less', () => {
    expect(
      sameColonyStats(
        toColonyStats(players(50)),
        toColonyStats(players(50).slice(1))
      )
    ).toBe(false);
  });
});
