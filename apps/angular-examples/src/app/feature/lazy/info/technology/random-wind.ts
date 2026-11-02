/** a random direction for the dust to blow to, in whole degrees clockwise from up */
export function randomWindDirection(): number {
  return Math.floor(Math.random() * 360);
}
