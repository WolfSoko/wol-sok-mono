export function movingAverage(
  windowSize: number
): (values: [preAverage: number, nextAverage: number]) => number {
  const nextWeight = 1.0 / windowSize;
  const prevWeight = 1.0 - nextWeight;
  return ([preAverage, nextAverage]: [
    preAverage: number,
    nextAverage: number
  ]) => prevWeight * preAverage + nextWeight * nextAverage;
}
