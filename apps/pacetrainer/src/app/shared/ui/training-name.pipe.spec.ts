import { describe, expect, it } from 'vitest';
import { CountdownTarget } from '../model/training/training-name';
import { TrainingNamePipe } from './training-name.pipe';

const GERMAN_NAMES: Record<CountdownTarget, string> = {
  running: 'Joggen',
  sprint: 'Sprinten',
  recovery: 'Erholung',
  finished: 'Fertig',
};

describe('TrainingNamePipe', () => {
  const pipe = new TrainingNamePipe();

  it.each(Object.entries(GERMAN_NAMES) as [CountdownTarget, string][])(
    'names %s "%s"',
    (name, text) => {
      expect(pipe.transform(name)).toBe(text);
    }
  );

  it('passes a missing name through', () => {
    expect(pipe.transform(null)).toBeNull();
    expect(pipe.transform(undefined)).toBeUndefined();
  });
});
