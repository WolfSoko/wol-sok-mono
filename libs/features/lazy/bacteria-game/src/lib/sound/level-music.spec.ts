import {
  HEART_PERIOD_SEC,
  LEVELS,
  parseGeneratedId,
  RECIPE_IDS,
  tuneSeed,
} from '@wolsok/feat-shared-bacteria-engine';
import {
  composeLoop,
  degreeToMidi,
  LEVEL_MUSIC,
  levelMusic,
  midiToHz,
  STEPS_PER_BAR,
  stepSeconds,
} from './level-music';

describe('level music', () => {
  it('gives every level a tune of its own', () => {
    for (const level of LEVELS) {
      expect(LEVEL_MUSIC[level.id]).toBeDefined();
    }
    const seeds = Object.values(LEVEL_MUSIC).map((music) => music.seed);
    expect(new Set(seeds).size).toBe(seeds.length);
  });

  it('falls back to the first level for an unknown id', () => {
    expect(levelMusic('nowhere')).toBe(LEVEL_MUSIC['petri-dish']);
  });

  it('tunes A4 to 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440);
    expect(midiToHz(57)).toBeCloseTo(220);
  });

  it('counts scale degrees across octaves', () => {
    const music = LEVEL_MUSIC['petri-dish'];

    expect(degreeToMidi(music, 0)).toBe(music.root);
    expect(degreeToMidi(music, 7)).toBe(music.root + 12);
    expect(degreeToMidi(music, -1)).toBe(music.root - 1);
    expect(degreeToMidi(music, 2)).toBe(music.root + 4);
    expect(degreeToMidi(music, 2, 2)).toBe(music.root + 28);
  });

  it('plays a sixteenth in a quarter of a beat', () => {
    expect(stepSeconds(60)).toBe(0.25);
  });

  it('beats in time with the heart of its map', () => {
    // One heartbeat is two beats - eight sixteenths - of its music.
    expect(stepSeconds(LEVEL_MUSIC['heartbeat'].bpm) * 8).toBeCloseTo(
      HEART_PERIOD_SEC
    );
  });

  describe.each(Object.entries(LEVEL_MUSIC))('%s', (_id, music) => {
    const loop = composeLoop(music);
    const pitchClass = (midi: number) => (((midi - music.root) % 12) + 12) % 12;
    const inKey = (midi: number) => music.scale.includes(pitchClass(midi));

    it('comes out the same every time', () => {
      expect(composeLoop(music)).toEqual(loop);
    });

    it('plays the progression twice in whole bars', () => {
      expect(loop.steps).toBe(music.progression.length * 2 * STEPS_PER_BAR);
    });

    it('keeps every note in the key and inside the loop', () => {
      for (const note of loop.notes) {
        expect(inKey(note.midi)).toBe(true);
        expect(note.step).toBeGreaterThanOrEqual(0);
        expect(note.step + note.steps).toBeLessThanOrEqual(loop.steps);
        expect(note.steps).toBeGreaterThan(0);
      }
      for (const hit of loop.drums) {
        expect(hit.step).toBeLessThan(loop.steps);
      }
    });

    it('has a melody, a bass and a pad in every bar', () => {
      for (let bar = 0; bar < loop.steps / STEPS_PER_BAR; bar++) {
        const voices = new Set(
          loop.notes
            .filter((note) => Math.floor(note.step / STEPS_PER_BAR) === bar)
            .map((note) => note.voice)
        );
        expect([...voices].sort()).toEqual(['bass', 'lead', 'pad']);
      }
    });

    it('lands the melody on a chord tone on every beat', () => {
      const octave = music.scale.length;
      for (const note of loop.notes) {
        if (note.voice !== 'lead' || note.step % 4 !== 0) {
          continue;
        }
        const bar = Math.floor(note.step / STEPS_PER_BAR);
        const chord = music.progression[bar % music.progression.length];
        const chordTones = [0, 2, 4, octave].map((tone) =>
          pitchClass(degreeToMidi(music, chord + tone))
        );
        expect(chordTones).toContain(pitchClass(note.midi));
      }
    });

    it('sings in a range a phone speaker can play', () => {
      for (const note of loop.notes) {
        expect(midiToHz(note.midi)).toBeGreaterThan(80);
        expect(midiToHz(note.midi)).toBeLessThan(2000);
      }
    });
  });
});

describe('the music of a generated level', () => {
  const id = 'gen:corridor:12345:4';

  it('plays its own tune, the same each time', () => {
    expect(levelMusic(id).seed).toBe(tuneSeed(parseGeneratedId(id)!));
    // The same tune each time: the player restarts one handed anew.
    expect(levelMusic(id)).toBe(levelMusic(id));
  });

  it('plays a tune of its own: the style sets the sound, the seed the chords', () => {
    const tune = levelMusic(id);
    const sameStyle = levelMusic('gen:corridor:999:4');
    const harder = levelMusic('gen:corridor:12345:9');

    // Corridors drive in a minor key; the seed moves the key a little.
    expect(tune.drums).toBe('drive');
    expect(tune.bass).toBe(sameStyle.bass);
    expect(Math.abs(tune.root - 45)).toBeLessThanOrEqual(2);
    expect(harder.bpm).toBeGreaterThan(tune.bpm);
    expect(levelMusic('gen:cave:12345:4').lead).not.toBe(tune.lead);
    for (const level of LEVELS) {
      expect(tune).not.toEqual(LEVEL_MUSIC[level.id]);
    }
  });

  it('composes into a loop for every style', () => {
    for (const recipe of RECIPE_IDS) {
      const loop = composeLoop(levelMusic(`gen:${recipe}:4242:6`));

      expect(loop.notes.length).toBeGreaterThan(0);
      expect(loop.steps).toBeGreaterThan(0);
    }
  });
});
