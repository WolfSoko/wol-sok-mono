/**
 * The ffmpeg filter that fades each film of a reel into the next.
 *
 * For films of the given lengths (seconds) as inputs 0, 1, 2 ... it chains
 * xfade filters: `[0:v][1:v]xfade...[v1];[v1][2:v]xfade...[v2]`; the last
 * label, `[v<count - 1>]`, is the reel. Each fade starts `fade` seconds
 * before the film running until then ends, so the reel is shorter than the
 * films together by one fade per cut.
 */
export function crossfades(lengths: number[], fade: number): string {
  const steps: string[] = [];
  let shown = lengths[0];
  for (let i = 1; i < lengths.length; i++) {
    const from = i === 1 ? '[0:v]' : `[v${i - 1}]`;
    const offset = (shown - fade).toFixed(3);
    steps.push(
      `${from}[${i}:v]xfade=transition=fade:duration=${fade}:offset=${offset}[v${i}]`
    );
    shown += lengths[i] - fade;
  }
  return steps.join(';');
}
