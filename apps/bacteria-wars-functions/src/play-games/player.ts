/**
 * The Play Games player behind a one-time server auth code (#3175 step 2):
 * the code is exchanged at Google's token endpoint for an access token of
 * the player, which reads `games/v1/players/me`. Nothing of it is kept but
 * the player's id and name.
 */

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const PLAYER_URL = 'https://games.googleapis.com/games/v1/players/me';

/** The web OAuth client the app asks Play Games for codes for. */
export interface OAuthClient {
  id: string;
  secret: string;
}

export interface PlayGamesPlayer {
  playerId: string;
  displayName: string | null;
}

/**
 * The player the code stands for - null when Google refuses the code
 * (expired, used once already, or for another client) or names no
 * player. Throws only for what is not the code's fault: a network error.
 */
export async function playGamesPlayer(
  code: string,
  client: OAuthClient,
  fetchFn: typeof fetch
): Promise<PlayGamesPlayer | null> {
  const token = await fetchFn(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: client.id,
      client_secret: client.secret,
      grant_type: 'authorization_code',
      // Play Games' server auth codes carry no redirect; Google wants it
      // empty rather than missing.
      redirect_uri: '',
    }).toString(),
  });
  if (!token.ok) {
    return null;
  }
  const accessToken = stringField(await token.json(), 'access_token');
  if (accessToken === null) {
    return null;
  }
  const player = await fetchFn(PLAYER_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!player.ok) {
    return null;
  }
  const body: unknown = await player.json();
  const playerId = stringField(body, 'playerId');
  return playerId === null
    ? null
    : { playerId, displayName: stringField(body, 'displayName') };
}

function stringField(body: unknown, key: string): string | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const value = (body as Record<string, unknown>)[key];
  return typeof value === 'string' && value.length > 0 ? value : null;
}
