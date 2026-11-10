import { caughtError } from '../../testing/caught-error';
import { DbbObject } from './dbb-object';
import { mapClub } from './map-club';

describe('mapClub', () => {
  it('reads the Verein by its id and name', () => {
    const club = DbbObject.of(
      {
        vereinId: 1476,
        vereinsname: ' Post SV Nürnberg ',
        vereinsnummer: '0231318',
      },
      'club'
    );

    expect(mapClub(club)).toEqual({ id: 1476, name: 'Post SV Nürnberg' });
  });

  it('refuses a Verein without a name', () => {
    expect(
      caughtError(() => mapClub(DbbObject.of({ vereinId: 1476 }, 'club')))
        .message
    ).toBe('club.vereinsname: expected a string, got nothing');
  });
});
