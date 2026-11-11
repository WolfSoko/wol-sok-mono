import { parseJson } from './parse-json';

describe('parseJson', () => {
  it('parses JSON', () => {
    expect(parseJson('{"a":[1,2]}')).toEqual({ a: [1, 2] });
  });

  it('is null for none or unreadable text', () => {
    expect(parseJson(null)).toBeNull();
    expect(parseJson('{not json')).toBeNull();
  });
});
