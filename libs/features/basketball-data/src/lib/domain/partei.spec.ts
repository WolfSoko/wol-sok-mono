import { istTeam, parteiName, type SpielPartei } from './partei';

const TEAM: SpielPartei = {
  art: 'team',
  team: { id: 313036, name: 'MTV Wasbüttel', vereinId: 1837 },
};
const SLOT: SpielPartei = { art: 'offen', bezeichnung: 'Nord 1. Platz' };

describe('istTeam', () => {
  it('knows a Team by its id', () => {
    expect(istTeam(TEAM, 313036)).toBe(true);
    expect(istTeam(TEAM, 201500)).toBe(false);
  });

  it('takes a slot for no Team', () => {
    expect(istTeam(SLOT, 313036)).toBe(false);
  });
});

describe('parteiName', () => {
  it('names a Team by its name and a slot by what it waits for', () => {
    expect(parteiName(TEAM)).toBe('MTV Wasbüttel');
    expect(parteiName(SLOT)).toBe('Nord 1. Platz');
  });
});
