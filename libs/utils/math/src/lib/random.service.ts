export class RandomService {
  randomTo(to: number): number {
    return this.random(0, to);
  }

  random(from: number, to: number): number {
    if (to == null) {
      to = from;
      from = 0;
    }
    return Math.random() * (to - from) + from;
  }
}
