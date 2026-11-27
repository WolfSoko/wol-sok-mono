/**
 * The dish duel's sound: two streams of cells swell from left and right,
 * collide, and from then on the kick carries the fight while cell after
 * cell of blue's front slides down to orange.
 */
import { seededRandom } from '../../../promo-video/synth';
import { hit, noiseFrom, scatter, thump, turns } from '../effects';
import {
  bassline,
  blips,
  BOTH_BARS,
  claps,
  FIRST_BAR,
  hats,
  kicks,
  pad,
  SECOND_BAR,
  ShotScore,
} from '../score';
import { frameSeconds, Take } from '../take';
import { hiss, shaped, swell } from '../voices';

const SEED = 44;

/* The frames of blender/scenes/dish_duel.py. */
/** Timeline, 37-45: the fronts meet and pile up. */
const FRONTS_MEET = 37;
/** `FIGHT = swarm.Fight(start=44)`: from here cells change sides. */
const FIGHT_STARTS = 44;
/** Timeline, 46-80: blue's front flashes and turns orange cell by cell. */
const FRONT_TURNS = { from: 46, to: 80 };
/** Timeline, 81-120: blue backs off, orange closes round what is left. */
const ORANGE_CLOSES = { from: 81, to: 120 };

/** Frames between two cells changing sides, on average. */
const FRONT_TURN_EVERY = 1.5;
const LATE_TURN_EVERY = 4;

/** Orange comes from the left and sounds duller, blue from the right. */
const STREAMS = [
  { pan: -0.7, openness: 0.05 },
  { pan: 0.7, openness: 0.12 },
];

export const dishDuel: ShotScore = (take, chord) => {
  const rnd = seededRandom(SEED);
  const noise = noiseFrom(rnd);

  pad(take, chord, 0, take.seconds);
  bassline(take, chord, BOTH_BARS);
  hats(take, noise, BOTH_BARS);
  blips(take, chord, rnd, FIRST_BAR, 0.5);
  kicks(take, SECOND_BAR);
  claps(take, noise, SECOND_BAR);

  streams(take, noise);
  thump(take, frameSeconds(FRONTS_MEET));
  hit(take, frameSeconds(FIGHT_STARTS), noise);
  for (const [span, every] of [
    [FRONT_TURNS, FRONT_TURN_EVERY],
    [ORANGE_CLOSES, LATE_TURN_EVERY],
  ] as const) {
    turns(take, scatter(span.from, span.to, every, rnd), chord, 'orange', rnd);
  }
  closing(take, noise);
};

/** Both colonies flow towards each other: two hisses that swell until they meet. */
function streams(take: Take, noise: () => number): void {
  const untilMeeting = frameSeconds(FRONTS_MEET);
  const release = 0.25;
  for (const { pan, openness } of STREAMS) {
    take.add(
      0,
      untilMeeting + release,
      shaped(
        hiss(noise, () => openness),
        swell(untilMeeting, untilMeeting + release, release)
      ),
      pan,
      0.8
    );
  }
}

/** Orange closes round blue: a hiss that grows duller as the gap shuts. */
function closing(take: Take, noise: () => number): void {
  const from = frameSeconds(ORANGE_CLOSES.from);
  const seconds = frameSeconds(ORANGE_CLOSES.to) - from;
  take.add(
    from,
    seconds,
    shaped(
      hiss(noise, (t) => 0.2 - 0.17 * (t / seconds)),
      swell(0.5, seconds, 0.5)
    ),
    0.3,
    0.2
  );
}
