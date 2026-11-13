import { cardName, type TeamCard } from './team-card';

describe('cardName', () => {
  it('names a Team by its name once its Saison was read', () => {
    const card = {
      kind: 'loaded',
      teamId: 313036,
      name: 'MTV Wasbüttel',
      club: { id: 4242, name: 'MTV Wasbüttel' },
      cancellations: [],
      seasonOver: false,
    } as const satisfies TeamCard;

    expect(cardName(card)).toBe('MTV Wasbüttel');
  });

  it('names a Team by its id while it loads or where its read failed', () => {
    expect(cardName({ kind: 'loading', teamId: 201500 })).toBe('Team 201500');
    expect(cardName({ kind: 'error', teamId: 201500, text: 'Fehler' })).toBe(
      'Team 201500'
    );
  });
});
