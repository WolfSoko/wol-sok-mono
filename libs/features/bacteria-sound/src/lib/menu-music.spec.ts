import { STEPS_PER_BAR } from './level-music';
import {
  composeMenuMusic,
  MENU_CHORDS,
  MENU_ROOT,
  MenuNote,
  STEPS_PER_CHORD,
} from './menu-music';

describe('menu music', () => {
  const score = composeMenuMusic(1);
  const of = (voice: MenuNote['voice']) =>
    score.notes.filter((note) => note.voice === voice);

  it('comes out the same for the same seed', () => {
    expect(composeMenuMusic(1)).toEqual(score);
  });

  it('rings other bells for another seed, over the same chords', () => {
    const other = composeMenuMusic(2);
    const bells = (notes: MenuNote[]) =>
      notes.filter((note) => note.voice === 'bell');
    const pads = (notes: MenuNote[]) =>
      notes.filter((note) => note.voice === 'pad');

    expect(bells(other.notes)).not.toEqual(bells(score.notes));
    expect(pads(other.notes)).toEqual(pads(score.notes));
  });

  it('holds every chord for two bars with the pad', () => {
    expect(score.steps).toBe(MENU_CHORDS.length * STEPS_PER_CHORD);
    MENU_CHORDS.forEach((chord, index) => {
      const pad = of('pad').filter(
        (note) => note.step === index * STEPS_PER_CHORD
      );
      expect(pad.map((note) => note.midi - MENU_ROOT - 12)).toEqual([...chord]);
      expect(pad.every((note) => note.steps === STEPS_PER_CHORD)).toBe(true);
    });
  });

  it('puts the root and then its fifth under every chord', () => {
    MENU_CHORDS.forEach((chord, index) => {
      const start = index * STEPS_PER_CHORD;
      const bass = of('bass').filter(
        (note) => note.step >= start && note.step < start + STEPS_PER_CHORD
      );
      expect(bass.map((note) => [note.step - start, note.midi])).toEqual([
        [0, MENU_ROOT - 12 + chord[0]],
        [STEPS_PER_BAR, MENU_ROOT - 12 + chord[0] + 7],
      ]);
    });
  });

  it('only rings the bells on the chord under them', () => {
    for (const bell of of('bell')) {
      const chord = MENU_CHORDS[Math.floor(bell.step / STEPS_PER_CHORD)];
      expect(chord).toContain(bell.midi - MENU_ROOT - 24);
      expect(bell.pan).toBeGreaterThanOrEqual(-1);
      expect(bell.pan).toBeLessThanOrEqual(1);
      expect(bell.velocity).toBeGreaterThan(0);
      expect(bell.velocity).toBeLessThanOrEqual(1);
    }
  });

  it('strikes a bell on the first step of every chord, and leaves room', () => {
    const bells = of('bell');
    MENU_CHORDS.forEach((_chord, index) => {
      const start = index * STEPS_PER_CHORD;
      expect(bells.some((note) => note.step === start)).toBe(true);
      const inChord = bells.filter(
        (note) => note.step >= start && note.step < start + STEPS_PER_CHORD
      );
      expect(inChord.length).toBeLessThan(STEPS_PER_CHORD / 2);
    });
  });

  it('breathes once under every chord', () => {
    expect(of('breath').length).toBe(MENU_CHORDS.length);
  });

  it('keeps every note inside the pass', () => {
    for (const note of score.notes) {
      expect(note.step).toBeGreaterThanOrEqual(0);
      expect(note.step).toBeLessThan(score.steps);
    }
  });
});
