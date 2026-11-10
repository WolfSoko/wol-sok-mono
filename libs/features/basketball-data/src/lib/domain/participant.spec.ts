import { isTeam, participantName, type Participant } from './participant';

const TEAM: Participant = {
  kind: 'team',
  team: { id: 313036, name: 'MTV Wasbüttel', clubId: 1837 },
};
const SLOT: Participant = { kind: 'open', label: 'Nord 1. Platz' };

describe('isTeam', () => {
  it('knows a Team by its id', () => {
    expect(isTeam(TEAM, 313036)).toBe(true);
    expect(isTeam(TEAM, 201500)).toBe(false);
  });

  it('takes a slot for no Team', () => {
    expect(isTeam(SLOT, 313036)).toBe(false);
  });
});

describe('participantName', () => {
  it('names a Team by its name and a slot by what it waits for', () => {
    expect(participantName(TEAM)).toBe('MTV Wasbüttel');
    expect(participantName(SLOT)).toBe('Nord 1. Platz');
  });
});
