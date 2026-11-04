import {
  isTimeRunningOut,
  matchClockLabel,
  matchClockText,
  RUNNING_OUT_SEC,
} from './match-clock';

describe('the match clock', () => {
  it.each([
    [null, 65, '1:05'],
    [null, 0, '0:00'],
    [42, 300, '0:42'],
    [0, 300, '0:00'],
  ])('shows %p seconds left after %p played as %p', (left, played, shown) => {
    expect(matchClockText(left, played)).toBe(shown);
  });

  it.each([
    [null, 'stage.hud.gameTime'],
    [30, 'stage.hud.timeLeft'],
    [0, 'stage.hud.timeLeft'],
  ])('labels %p seconds left as %p', (left, label) => {
    expect(matchClockLabel(left)).toBe(label);
  });

  it.each([
    [true, RUNNING_OUT_SEC, true],
    [true, RUNNING_OUT_SEC + 1, false],
    [true, 0, true],
    [false, 3, false],
    [true, null, false],
  ])(
    'tells the time running out while running %p with %p left: %p',
    (running, left, out) => {
      expect(isTimeRunningOut(running, left)).toBe(out);
    }
  );
});
