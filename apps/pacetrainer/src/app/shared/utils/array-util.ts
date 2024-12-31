export function replaceAt<T>(
  list: T[],
  index: number,
  ...replacement: T[]
): T[] {
  if (index < 0) {
    throw new Error('Negative indexes are not supported');
  }
  return [
    ...list.slice(0, index),
    ...replacement,
    ...list.slice(index + replacement.length),
  ];
}
