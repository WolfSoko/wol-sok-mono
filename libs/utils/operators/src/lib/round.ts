export function round(decimals: number): (n: number) => number {
  return (n: number) => {
    const factor = Math.pow(10, decimals);
    return Math.round(n * factor) / factor;
  };
}
