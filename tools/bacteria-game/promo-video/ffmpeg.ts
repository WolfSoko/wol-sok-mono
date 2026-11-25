import { execFileSync } from 'node:child_process';

/** An ffmpeg with libx264: FFMPEG, the PATH, or one fetched by uvx. */
export function ffmpeg(): string {
  if (process.env['FFMPEG']) {
    return process.env['FFMPEG'];
  }
  try {
    execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' });
    return 'ffmpeg';
  } catch {
    return execFileSync(
      'uvx',
      [
        '--from',
        'imageio-ffmpeg',
        'python',
        '-I',
        '-c',
        'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())',
      ],
      { encoding: 'utf8' }
    ).trim();
  }
}
