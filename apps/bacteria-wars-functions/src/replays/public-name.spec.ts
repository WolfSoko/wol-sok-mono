import { Engine, loadEngine } from '../engine';
import { isBlockedName, publicNameOf } from './public-name';

let engine: Engine;

beforeAll(async () => {
  engine = await loadEngine();
});

describe('public names', () => {
  it('shows a name only with the opt-in', () => {
    expect(publicNameOf(engine, { name: 'Ana', publicName: true })).toBe('Ana');
    expect(publicNameOf(engine, { name: 'Ana' })).toBeNull();
    expect(publicNameOf(engine, { name: 'Ana', publicName: false })).toBeNull();
    expect(publicNameOf(engine, undefined)).toBeNull();
  });

  it('falls back for blocked names, also spelled around', () => {
    expect(isBlockedName('Hurensohn')).toBe(true);
    expect(isBlockedName('F.u.c.k')).toBe(true);
    expect(isBlockedName('sh1t happens')).toBe(true);
    expect(isBlockedName('Schlämpe')).toBe(false);
    expect(isBlockedName('Ana')).toBe(false);
    expect(publicNameOf(engine, { name: 'n4zi', publicName: true })).toBeNull();
  });

  it('falls back for names that pose as a label', () => {
    expect(
      publicNameOf(engine, { name: 'Anonymous #1234', publicName: true })
    ).toBeNull();
    expect(
      publicNameOf(engine, { name: 'Player 0042', publicName: true })
    ).toBeNull();
  });
});
