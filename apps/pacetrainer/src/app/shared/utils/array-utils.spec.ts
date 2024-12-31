import { replaceAt } from './array-util';

describe('replaceAt', () => {
  it('should replace elements at specified index with replacement elements', () => {
    const list = [1, 2, 3, 4, 5];
    const result = replaceAt(list, 2, 9, 8);
    expect(result).toEqual([1, 2, 9, 8, 5]);
  });

  it('should replace successive elements when replacement is longer', () => {
    const list = [1, 2, 3, 4, 5];
    const result = replaceAt(list, 1, 7, 8, 9);
    expect(result).toEqual([1, 7, 8, 9, 5]);
  });

  it('should replace element when replacement is only one element', () => {
    const list = [1, 2, 3, 4, 5];
    const result = replaceAt(list, 1, 9);
    expect(result).toEqual([1, 9, 3, 4, 5]);
  });

  it('should return the same array if replacement is empty', () => {
    const list = [1, 2, 3, 4, 5];
    const result = replaceAt(list, 2);
    expect(result).toEqual([1, 2, 3, 4, 5]);
  });

  it('should throw for negative index', () => {
    const list = [1, 2, 3, 4, 5];
    expect(() => replaceAt(list, -2, 9)).toThrow();
  });

  it('should handle index out of bounds gracefully', () => {
    const list = [1, 2, 3];
    const result = replaceAt(list, 10, 9);
    expect(result).toEqual([1, 2, 3, 9]);
  });

  it('should handle empty list', () => {
    const list: number[] = [];
    const result = replaceAt(list, 0, 1);
    expect(result).toEqual([1]);
  });

  it('should handle replacement with different types', () => {
    const list = ['a', 'b', 'c'];
    const result = replaceAt(list, 1, 'x', 'y');
    expect(result).toEqual(['a', 'x', 'y']);
  });
});
