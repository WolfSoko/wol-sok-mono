import { caughtError } from '../../testing/caught-error';
import { DbbObject } from './dbb-object';

function shapeErrorOf(read: () => unknown): string {
  const error = caughtError(read);
  expect(error.kind).toBe('unexpected-shape');
  return error.message;
}

describe('DbbObject', () => {
  const object = DbbObject.of(
    {
      id: 7,
      name: 'Kieler TB',
      empty: null,
      flag: true,
      team: { clubId: 1149 },
      matches: [{ matchId: 1 }, { matchId: 2 }],
    },
    'match'
  );

  it('reads present fields', () => {
    expect(object.number('id')).toBe(7);
    expect(object.string('name')).toBe('Kieler TB');
    expect(object.boolean('flag')).toBe(true);
    expect(object.object('team').number('clubId')).toBe(1149);
    expect(object.objects('matches').map((m) => m.number('matchId'))).toEqual([
      1, 2,
    ]);
  });

  it('hands out a present value of any type', () => {
    expect(object.value('team')).toEqual({ clubId: 1149 });
    expect(shapeErrorOf(() => object.value('empty'))).toBe(
      'match.empty: expected a value, got null'
    );
  });

  it('reads null or missing optional fields as absent', () => {
    expect(object.optionalNumber('empty')).toBeUndefined();
    expect(object.optionalString('missing')).toBeUndefined();
    expect(object.optionalObject('empty')).toBeUndefined();
    expect(object.optionalObjects('empty')).toEqual([]);
    expect(object.optionalBoolean('missing')).toBe(false);
  });

  it('names the path of a field of the wrong type', () => {
    expect(shapeErrorOf(() => object.number('name'))).toBe(
      'match.name: expected a number, got "Kieler TB"'
    );
    expect(shapeErrorOf(() => object.object('team').string('clubId'))).toBe(
      'match.team.clubId: expected a string, got 1149'
    );
    expect(shapeErrorOf(() => object.objects('name'))).toContain(
      'match.name: expected a list'
    );
  });

  it('names the index of a list item that is no object', () => {
    const list = DbbObject.of({ items: [{}, 3] }, 'root');

    expect(shapeErrorOf(() => list.objects('items'))).toBe(
      'root.items[1]: expected an object, got 3'
    );
  });

  it('refuses a value that is no object', () => {
    expect(shapeErrorOf(() => DbbObject.of([1], 'data'))).toBe(
      'data: expected an object, got [1]'
    );
  });
});
