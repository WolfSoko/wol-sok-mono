import { LEVELS } from '../state/levels';
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
  });

  it('plays a sixteenth in a quarter of a beat', () => {
    expect(stepSeconds(60)).toBe(0.25);
  });

  it('beats in time with the heart of its map', () => {
    // The heart beats every 1.6 s: two beats at the tempo of its music.
    expect(stepSeconds(LEVEL_MUSIC['heartbeat'].bpm) * 8).toBeCloseTo(1.6);
  });

  describe.each(Object.entries(LEVEL_MUSIC))('%s', (_id, music) => {
    const loop = composeLoop(music);
    const inKey = (midi: number) =>
      music.scale.includes((((midi - music.root) % 12) + 12) % 12);

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
      const pitchClass = (midi: number) =>
        (((midi - music.root) % 12) + 12) % 12;
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
