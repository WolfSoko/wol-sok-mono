import { caughtError } from '../../testing/caught-error';
import { readEnvelope } from './envelope';
import notFound from './fixtures/table-not-found.json';
import unavailable from './fixtures/envelope-unavailable.json';

describe('readEnvelope', () => {
  it('hands out the data of status "0"', () => {
    const data = { ligaId: 54308 };

    expect(readEnvelope({ status: '0', message: '', data })).toBe(data);
  });

  it('reads status "1" as not found, with the DBB message', () => {
    const error = caughtError(() => readEnvelope(notFound));

    expect(error.kind).toBe('not-found');
    expect(error.message).toContain('no competition found with id 1');
  });

  it('reads status "1" as not found even where data is set', () => {
    const envelope = { status: '1', message: 'no team', data: { team: null } };

    expect(caughtError(() => readEnvelope(envelope)).kind).toBe('not-found');
  });

  it('reads status "-1" as unavailable', () => {
    expect(caughtError(() => readEnvelope(unavailable)).kind).toBe(
      'unavailable'
    );
  });

  it.each([
    ['no object', 'oops'],
    ['null', null],
    ['an array', []],
    ['no status', { data: {} }],
    ['an unknown status', { status: '2', data: {} }],
    ['a numeric status', { status: 0, data: {} }],
    ['status "0" without data', { status: '0', message: '', data: null }],
  ])('reads %s as an unexpected shape', (_case, envelope) => {
    expect(caughtError(() => readEnvelope(envelope)).kind).toBe(
      'unexpected-shape'
    );
  });
});
