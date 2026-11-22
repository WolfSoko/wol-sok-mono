import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PLAY_GAMES_WEB_CLIENT_ID } from '../config';

/**
 * The app asks Play Games for codes for the web client in its
 * `google-services.json` (`default_web_client_id`, the client of type 3);
 * the function exchanges them as `PLAY_GAMES_WEB_CLIENT_ID`. Google refuses
 * a code for another client, so a regenerated file with a new web client
 * would break every sign-in without a word.
 */
describe('the web OAuth client of the Play Games sign-in', () => {
  it('is the one the Android app asks codes for', () => {
    const services = JSON.parse(
      readFileSync(
        join(
          __dirname,
          '../../../bacteria-wars-android/app/google-services.json'
        ),
        'utf8'
      )
    ) as {
      client: { oauth_client?: { client_id: string; client_type: number }[] }[];
    };
    const webClients = services.client
      .flatMap((client) => client.oauth_client ?? [])
      .filter((client) => client.client_type === 3)
      .map((client) => client.client_id);

    expect(new Set(webClients)).toEqual(new Set([PLAY_GAMES_WEB_CLIENT_ID]));
  });
});
