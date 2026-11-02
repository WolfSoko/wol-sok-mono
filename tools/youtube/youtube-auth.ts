/**
 * One-time, by hand: mints the OAuth refresh token that `youtube.ts` uploads
 * with, for the channel owner.
 *
 * Step 1 prints Google's consent URL; open it in any browser, sign in and
 * pick the wolfsoko-org channel on the account chooser - the token is bound to
 * that choice. Google then redirects to http://127.0.0.1:8765/..., which does
 * not load; copy that address from the address bar and hand it to step 2,
 * which writes the refresh token to a file (mode 600) for the GitHub secret
 * YOUTUBE_OAUTH_REFRESH_TOKEN:
 *
 *   YOUTUBE_OAUTH_CLIENT_ID=... YOUTUBE_OAUTH_CLIENT_SECRET=... \
 *     npx tsx tools/youtube/youtube-auth.ts --start --state-file /tmp/yt-state
 *   YOUTUBE_OAUTH_CLIENT_ID=... YOUTUBE_OAUTH_CLIENT_SECRET=... \
 *     npx tsx tools/youtube/youtube-auth.ts --finish --state-file /tmp/yt-state \
 *       --redirect-url '<address from the browser>' --out /tmp/yt-refresh-token
 *
 * The OAuth client is a "Desktop app" client of the GCP project
 * bacteria-wars; see tools/youtube/README.md for its setup.
 */
import { randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { CLIENT_ID_ENV, CLIENT_SECRET_ENV, SCOPES } from './youtube';

/** Desktop clients take any loopback address; nothing has to listen there. */
const REDIRECT_URI = 'http://127.0.0.1:8765/oauth2callback';

function arg(name: string): string | undefined {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function env(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set`);
  }
  return value;
}

async function main(): Promise<void> {
  const stateFile = arg('--state-file');
  if (stateFile == null) {
    throw new Error('--state-file <path> is missing');
  }
  if (process.argv.includes('--start')) {
    const state = randomBytes(16).toString('hex');
    writeFileSync(stateFile, state, { mode: 0o600 });
    const url = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    url.search = new URLSearchParams({
      client_id: env(CLIENT_ID_ENV),
      redirect_uri: REDIRECT_URI,
      response_type: 'code',
      scope: SCOPES.join(' '),
      // Without offline and consent Google hands out no refresh token.
      access_type: 'offline',
      prompt: 'consent',
      state,
    }).toString();
    console.log(url.href);
    return;
  }

  const redirect = new URL(arg('--redirect-url') ?? '');
  const out = arg('--out');
  if (out == null) {
    throw new Error('--out <path> is missing');
  }
  if (redirect.searchParams.get('state') !== readFileSync(stateFile, 'utf8')) {
    throw new Error('The state does not match the one of --start');
  }
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code: redirect.searchParams.get('code') ?? '',
      client_id: env(CLIENT_ID_ENV),
      client_secret: env(CLIENT_SECRET_ENV),
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });
  if (!response.ok) {
    throw new Error(
      `Token exchange failed: ${response.status} ${await response.text()}`
    );
  }
  const { refresh_token: refreshToken } = (await response.json()) as {
    refresh_token?: string;
  };
  if (!refreshToken) {
    throw new Error('Google returned no refresh token');
  }
  writeFileSync(out, refreshToken, { mode: 0o600 });
  console.log(`Refresh token written to ${out}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
