import { NEUTRAL_MOVES, NeutralBrain } from './neutral-brain';
import { ColonySummary } from './simulation';

const WIDTH = 640;
const HEIGHT = 360;

function colony(
  playerId: number,
  count: number,
  x: number,
  y: number
): ColonySummary {
  return {
    playerId,
    color: [128, 128, 128, 255],
    count,
    captured: 0,
    lost: 0,
    totalEnergy: count,
    center: { x, y },
    onHill: 0,
    pellets: 0,
  };
}

function steer(self: ColonySummary, others: ColonySummary[], random = 0.25) {
  return new NeutralBrain(() => random).steer(
    self,
    others,
    WIDTH,
    HEIGHT,
    1,
    1 / 60
  );
}

describe('NeutralBrain', () => {
  // About 18 cells across.
  const self = colony(2, 1000, 300, 180);

  it('strolls to a spot nearby while nobody is close', () => {
    const course = steer(self, [colony(0, 200, 30, 30)]);

    expect(course?.speed).toBe(NEUTRAL_MOVES.stroll);
    const distance = Math.hypot(course!.goal.x - 300, course!.goal.y - 180);
    // From its edge, about 18 cells from its centre.
    expect(distance).toBeGreaterThan(18);
    expect(distance).toBeLessThanOrEqual(18 + NEUTRAL_MOVES.wanderReach);
  });

  it('keeps heading for the same spot until it gets there', () => {
    const brain = new NeutralBrain(() => 0.6);
    const first = brain.steer(self, [], WIDTH, HEIGHT, 1, 1);
    const later = brain.steer(self, [], WIDTH, HEIGHT, 1, 1);

    expect(later?.goal).toEqual(first?.goal);

    const there = colony(2, 1000, first!.goal.x, first!.goal.y);
    expect(brain.steer(there, [], WIDTH, HEIGHT, 1, 1)?.goal).not.toEqual(
      first?.goal
    );
  });

  it('goes after a smaller colony that comes near', () => {
    const prey = colony(0, 300, 350, 180);

    expect(steer(self, [prey])).toEqual({
      goal: { x: 350, y: 180 },
      speed: NEUTRAL_MOVES.hurry,
    });
  });

  it('runs from a bigger colony that comes near, away from it', () => {
    const course = steer(self, [colony(0, 3000, 360, 180)]);

    expect(course?.speed).toBe(NEUTRAL_MOVES.hurry);
    expect(course!.goal.x).toBeLessThan(300 - NEUTRAL_MOVES.fleeReach / 2);
    expect(course!.goal.y).toBeCloseTo(180);
  });

  it('runs from a threat before it chases prey', () => {
    const course = steer(self, [
      colony(0, 300, 260, 180),
      colony(1, 3000, 360, 180),
    ]);

    expect(course!.goal.x).toBeLessThan(300);
    expect(course?.speed).toBe(NEUTRAL_MOVES.hurry);
  });

  it('leaves a colony of about its own size alone', () => {
    expect(steer(self, [colony(0, 1000, 340, 180)])?.speed).toBe(
      NEUTRAL_MOVES.stroll
    );
  });

  it('never heads off the arena', () => {
    const cornered = colony(2, 1000, 10, 10);
    const course = steer(cornered, [colony(0, 3000, 60, 60)]);

    expect(course!.goal.x).toBeGreaterThanOrEqual(NEUTRAL_MOVES.margin);
    expect(course!.goal.y).toBeGreaterThanOrEqual(NEUTRAL_MOVES.margin);
  });

  it('runs along the edge when the threat drives it into it', () => {
    const atEdge = colony(2, 1000, 300, 15);
    const course = steer(atEdge, [colony(0, 3000, 300, 70)]);

    // Not into the edge, where it would stay put: along it.
    expect(Math.abs(course!.goal.x - 300)).toBeGreaterThan(
      NEUTRAL_MOVES.fleeReach / 2
    );
  });

  it('keeps running until it is safe, not just out of reach', () => {
    const brain = new NeutralBrain(() => 0.25);
    const threat = colony(0, 3000, 360, 180);
    brain.steer(self, [threat], WIDTH, HEIGHT, 1, 1 / 60);

    // A gap of about 50: past the reach it ran from, short of safe.
    const further = colony(0, 3000, 400, 180);
    const course = brain.steer(self, [further], WIDTH, HEIGHT, 1, 1 / 60);

    expect(course?.speed).toBe(NEUTRAL_MOVES.hurry);
    expect(course!.goal.x).toBeLessThan(300);
  });

  it('has nowhere to go once it is eaten up', () => {
    expect(steer({ ...self, count: 0, center: null }, [])).toBeNull();
  });
});
