/**
 * How the films of a reel are cut together: each fades into the next, so
 * every film but the first starts one fade before the one running until
 * then ends, and the reel is shorter than the films together by one fade
 * per cut.
 */

/** How long one shot of the reel fades into the next, in seconds. */
export const REEL_FADE = 0.5;

/**
 * When each film of a reel starts, in seconds from the reel's start, for
 * films of the given lengths (seconds) and a fade of `fade` seconds.
 */
export function reelStarts(lengths: number[], fade: number): number[] {
  const starts: number[] = [];
  let start = 0;
  for (const length of lengths) {
    starts.push(start);
    start += length - fade;
  }
  return starts;
}

/** How long the reel of those films runs, in seconds. */
export function reelLength(lengths: number[], fade: number): number {
  const last = lengths.length - 1;
  return reelStarts(lengths, fade)[last] + lengths[last];
}

/**
 * The ffmpeg filter that fades each film of a reel into the next.
 *
 * For films of the given lengths (seconds) as inputs 0, 1, 2 ... it chains
 * xfade filters: `[0:v][1:v]xfade...[v1];[v1][2:v]xfade...[v2]`; the last
 * label, `[v<count - 1>]`, is the reel. Each fade starts where the film
 * fading in does (`reelStarts`).
 */
export function crossfades(lengths: number[], fade: number): string {
  return reelStarts(lengths, fade)
    .slice(1)
    .map((start, cut) => {
      const from = cut === 0 ? '[0:v]' : `[v${cut}]`;
      const into = cut + 1;
      return `${from}[${into}:v]xfade=transition=fade:duration=${fade}:offset=${start.toFixed(3)}[v${into}]`;
    })
    .join(';');
}
