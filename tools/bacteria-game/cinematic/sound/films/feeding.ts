/**
 * The feeding shot's sound: a gulp as the colony reaches each pellet, bites
 * while it eats, and the newborn cells popping up the chord, more of them
 * with every meal, as the music under them grows busier.
 */
import { seededRandom } from '../../../promo-video/synth';
import { noiseFrom, scatter } from '../effects';
import {
  bassline,
  blip,
  blips,
  BOTH_BARS,
  Chord,
  FIRST_BAR,
  hats,
  kicks,
  pad,
  SECOND_BAR,
  ShotScore,
} from '../score';
import { frameSeconds, Take } from '../take';
import { decay, oscillator, shaped, sizzle, slide } from '../voices';

const SEED = 9;

/**
 * `ORANGE_MEALS` of blender/scenes/feeding.py: the frames the crosshair is
 * over each pellet, and the cells the pellet is worth.
 */
const MEALS = [
  { arrive: 9, leave: 22, cells: 70 },
  { arrive: 31, leave: 46, cells: 110 },
  { arrive: 55, leave: 69, cells: 150 },
  { arrive: 80, leave: 120, cells: 340 },
];
type Meal = (typeof MEALS)[number];

/** Frames between two bites, on average. */
const BITE_EVERY = 2;
/** Newborn cells one pop stands for. */
const CELLS_PER_POP = 14;
/** The pitch a gulp starts at (Hz), and how much lower each bigger meal's is. */
const GULP_FROM = 520;
const GULP_DEEPER = 0.85;

export const feeding: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);

  pad(take, chord, 0, take.seconds);
  kicks(take, BOTH_BARS, 0.4);
  hats(take, noise, BOTH_BARS);
  bassline(take, chord, SECOND_BAR);
  blips(take, chord, rnd, FIRST_BAR, 0.25);
  blips(take, chord, rnd, SECOND_BAR, 0.6);

  for (const [course, meal] of MEALS.entries()) {
    gulp(take, frameSeconds(meal.arrive), course);
    bites(take, meal, rnd);
    newborns(take, meal, chord, rnd);
  }
};

/** The colony closes over a pellet: a note that drops, deeper as it grows. */
function gulp(take: Take, at: number, course: number): void {
  const from = GULP_FROM * GULP_DEEPER ** course;
  take.add(
    at,
    0.3,
    shaped(oscillator(slide(from, from / 3, 0.12)), decay(14)),
    0,
    0.2
  );
}

/** Bites while the crosshair is over the pellet: short, bright ticks. */
function bites(take: Take, meal: Meal, rnd: () => number): void {
  const noise = noiseFrom(rnd);
  for (const at of scatter(meal.arrive, meal.leave, BITE_EVERY, rnd)) {
    take.add(at, 0.05, shaped(sizzle(noise, 0.3), decay(70)), rnd() - 0.5, 0.1);
  }
}

/** Every bite becomes a newborn cell: pops that climb the chord. */
function newborns(
  take: Take,
  meal: Meal,
  chord: Chord,
  rnd: () => number
): void {
  const pops = Math.round(meal.cells / CELLS_PER_POP);
  const from = frameSeconds(meal.arrive);
  const seconds = frameSeconds(meal.leave) - from;
  for (let pop = 0; pop < pops; pop++) {
    const octave = 12 * (1 + (Math.floor(pop / chord.length) % 2));
    blip(
      take,
      from + (seconds * (pop + 1)) / (pops + 1),
      chord[pop % chord.length] + octave,
      rnd() * 1.2 - 0.6,
      0.08
    );
  }
}
