import { isObject } from './is-object';

describe('isObject', () => {
  it('tells objects from everything else', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});
