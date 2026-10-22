# YouTube uploads

`youtube.ts` puts videos on the wol-sok-org YouTube channel, each file once:
a video carries the SHA-256 of its file as a tag, so a run finds what is on
the channel already. The Bacteria Wars deploy
(`tools/bacteria-game/deploy-android.ts`) uploads its promo videos with it.

## One-time setup

YouTube has no service accounts: the API acts as the channel owner, through an
OAuth refresh token.

1. **API.** The YouTube Data API v3 is enabled in the GCP project
   `bacteria-wars`.
2. **OAuth consent screen** (Google Auth Platform → Branding / Audience in that
   project): user type **External**, publishing status **In production**. An
   app left in _Testing_ gets refresh tokens that expire after seven days.
   Don't list the YouTube scopes under data access; `youtube-auth.ts` asks for
   them at login (`youtube.upload`, `youtube.readonly`).
3. **OAuth client:** Clients → Create client → **Desktop app**. Its client id
   and secret go into the repository secrets `YOUTUBE_OAUTH_CLIENT_ID` and
   `YOUTUBE_OAUTH_CLIENT_SECRET`.
4. **Refresh token**, signed in as the owner of the wol-sok-org channel:

   ```bash
   YOUTUBE_OAUTH_CLIENT_ID=... YOUTUBE_OAUTH_CLIENT_SECRET=... \
     npx tsx tools/youtube/youtube-auth.ts --start --state-file /tmp/yt-state
   ```

   Open the printed URL, pick the **wol-sok-org** channel on the account
   chooser (the token is bound to it) and allow the access. The browser then
   fails to load `http://127.0.0.1:8765/...`; copy that address:

   ```bash
   YOUTUBE_OAUTH_CLIENT_ID=... YOUTUBE_OAUTH_CLIENT_SECRET=... \
     npx tsx tools/youtube/youtube-auth.ts --finish --state-file /tmp/yt-state \
       --redirect-url '<address from the browser>' --out /tmp/yt-refresh-token
   gh secret set YOUTUBE_OAUTH_REFRESH_TOKEN < /tmp/yt-refresh-token && rm /tmp/yt-refresh-token
   ```

## Caveats

- **Unaudited projects upload private only.** Until the project passes
  YouTube's API compliance audit (requested through the quota form in the
  Cloud console), every API upload is locked to _private_, whatever the
  requested privacy, and YouTube Studio cannot lift it. Play shows a promo
  video only when it is public or unlisted.
- **Quota.** `videos.insert` has a bucket of 100 calls a day; the lookups
  draw on the shared 10 000 units.
- **Revoking:** myaccount.google.com/permissions → remove the app, then mint
  a new token.
