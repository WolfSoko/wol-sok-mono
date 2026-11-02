import { isInteger, isObject } from './is-object';

describe('isObject', () => {
  it('tells objects from everything else', () => {
    expect(isObject({})).toBe(true);
    expect(isObject([])).toBe(true);
    expect(isObject(null)).toBe(false);
    expect(isObject('x')).toBe(false);
  });
});

describe('isInteger', () => {
  it('takes whole numbers within the bounds only', () => {
    expect(isInteger(3)).toBe(true);
    expect(isInteger(-3)).toBe(true);
    expect(isInteger(0, 1)).toBe(false);
    expect(isInteger(1, 1)).toBe(true);
    expect(isInteger(6, 1, 5)).toBe(false);
    expect(isInteger(1.5)).toBe(false);
    expect(isInteger('2')).toBe(false);
    expect(isInteger(NaN)).toBe(false);
  });
});
