import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import everyLeague from './fixtures/wam-data-alle.json';
import wamData from './fixtures/wam-data-bayern-u14.json';
import secondPage from './fixtures/wam-liga-list-bayern-u14-10.json';
import lastPage from './fixtures/wam-liga-list-schleswig-holstein-jugend-30.json';
import { mapLeaguePage, mapLeagueSearch } from './map-league-search';

describe('mapLeagueSearch', () => {
  const search = mapLeagueSearch(readEnvelope(wamData));

  it('marks the men’s professional Ligen, whose results the DBB never confirms, though the search sends no statisticType', () => {
    const { leagues } = mapLeagueSearch(readEnvelope(everyLeague)).firstPage;

    expect(
      leagues
        .filter((league) => league.resultsNeverConfirmed)
        .map((league) => league.name)
    ).toEqual([
      '1. Bundesliga (easyCredit BBL)',
      'Herren ProA',
      'Herren ProB Nord',
      'Herren ProB Süd',
    ]);
  });

  it('reads the Verband, age group and gender facets', () => {
    expect(search.facets.associations).toContainEqual({
      id: 2,
      name: 'Bayern',
      hits: 57,
    });
    expect(search.facets.ageGroups).toContainEqual({
      id: 14,
      name: 'U14',
      hits: 57,
    });
    expect(search.facets.ageGroupGenders).toEqual([
      { id: '2_1', name: 'Jugend männlich', hits: 41 },
      { id: '2_2', name: 'Jugend weiblich', hits: 16 },
    ]);
  });

  it('reads the first page of Ligen', () => {
    expect(search.firstPage.startIndex).toBe(0);
    expect(search.firstPage.more).toBe(true);
    expect(search.firstPage.leagues).toHaveLength(10);
    expect(search.firstPage.leagues[0]).toEqual({
      id: 54308,
      name: 'Bayernliga U14 männlich Einteilungsrunde Nord',
      association: { id: 2, name: 'Bayern' },
      ageGroup: 'U14',
      gender: 'male',
      division: 'Bayernliga',
    });
  });

  it('refuses a gender facet it cannot name', () => {
    const data = {
      ...(readEnvelope(wamData) as object),
      agkGeschlechtList: [
        { id: '2_3', akg: 'Jugend', geschlecht: 'x', hits: 1 },
      ],
    };

    expect(caughtError(() => mapLeagueSearch(data)).message).toBe(
      'wam.agkGeschlechtList[0].geschlecht: expected m or w, got "x"'
    );
  });
});

describe('mapLeaguePage', () => {
  it('reads a later page, with the Bezirk of a Liga below the Verband', () => {
    const page = mapLeaguePage(readEnvelope(secondPage));

    expect(page.startIndex).toBe(10);
    expect(page.more).toBe(true);
    expect(page.leagues.map((league) => league.id)).toContain(53790);
    expect(page.leagues.find((league) => league.id === 53790)?.district).toBe(
      'Oberbayern'
    );
  });

  it('knows the last page', () => {
    const page = mapLeaguePage(readEnvelope(lastPage));

    expect(page.startIndex).toBe(30);
    expect(page.more).toBe(false);
    expect(page.leagues).toHaveLength(7);
    expect(page.leagues[0].association.name).toBe('Schleswig-Holstein');
  });

  it('refuses a Liga of an unknown gender', () => {
    const data = readEnvelope(lastPage) as { ligen: object[] };
    const broken = {
      ...data,
      ligen: [{ ...data.ligen[0], geschlecht: 'divers' }],
    };

    expect(caughtError(() => mapLeaguePage(broken)).kind).toBe(
      'unexpected-shape'
    );
  });
});

describe('gender lookups', () => {
  it.each(['constructor', 'toString', '__proto__', 'hasOwnProperty'])(
    'refuse the inherited key %s as a Liga gender and a facet',
    (key) => {
      const list = readEnvelope(lastPage) as { ligen: object[] };
      const league = {
        ...list,
        ligen: [{ ...list.ligen[0], geschlecht: key }],
      };
      const search = {
        ...(readEnvelope(wamData) as object),
        agkGeschlechtList: [
          { id: '2_1', akg: 'Jugend', geschlecht: key, hits: 1 },
        ],
      };

      expect(caughtError(() => mapLeaguePage(league)).kind).toBe(
        'unexpected-shape'
      );
      expect(caughtError(() => mapLeagueSearch(search)).kind).toBe(
        'unexpected-shape'
      );
    }
  );
});
