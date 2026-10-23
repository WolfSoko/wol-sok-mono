# Bacteria Wars for Android

The Android app of the bacteria game. It is a
[Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity)
(TWA): a thin native shell that opens https://bacteria-wars.wolsok.de in
Chrome, fullscreen and without any browser UI. The game itself is the PWA
`bacteria-game-remote`, so every web deploy updates the app as well; only
changes to this folder need a new app release. Offline play, saves, sound and
haptics work as in the installed PWA.

What the shell adds:

- launcher icon (adaptive, with a monochrome layer for themed icons) and a
  splash screen, both drawn by `tools/bacteria-game/generate-icons.ts`
  (`npx nx run bacteria-game-remote:icons`)
- immersive mode, matching `"display": "fullscreen"` of the web manifest
- links to bacteria-wars.wolsok.de open in the app
- a WebView fallback for devices without a TWA-capable browser
- the Firebase app `de.wolsok.bacteriawars` of the game's project
  `bacteria-wars` (`app/google-services.json`, the `google-services` Gradle
  plugin and Firebase Analytics): Analytics counts the app's installs and
  opens, and the Android OAuth client Play Games Services asks for lives on
  that app. The manifest drops the advertising id permission Analytics
  brings along and turns its advertising id collection off, as the app's
  Play declaration says it uses none. The file holds no secret: the API key identifies the project and
  ships in every build, so restrict it in the Cloud console rather than hide
  it. Download it again from the Firebase console (Project settings → Your
  apps) after adding a signing key there.

## Build

Needs JDK 21 and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in
`local.properties`). The Gradle wrapper downloads Gradle itself.

```bash
npx nx run bacteria-wars-android:apk               # debug APK
npx nx run bacteria-wars-android:apk:release       # release APK
npx nx run bacteria-wars-android:bundle            # release app bundle for Play
npx nx run bacteria-wars-android:lint-android      # Android lint
```

Outputs land in `app/build/outputs/`. Install a debug APK with
`adb install app/build/outputs/apk/debug/app-debug.apk`.

The version comes from the workspace's `version.json`: 74.44.1 becomes
`versionName` 74.44.1 and `versionCode` 74044001.

The `Android app` GitHub workflow builds and lints the debug APK on every
change to this folder and keeps it as a workflow artifact, to try the app on a
phone. Each run signs it with a fresh debug key, so uninstall the previous one
before installing the next, and expect Chrome's URL bar on top: only keys
listed in `assetlinks.json` get fullscreen.

## Fullscreen needs Digital Asset Links

Chrome only hides its URL bar when the site and the app vouch for each other:

- the app names the site in its `asset_statements` (set in
  `app/build.gradle.kts`)
- the site names the app's package and the SHA-256 fingerprints of the keys it
  is signed with in
  `apps/bacteria-game-remote/src/.well-known/assetlinks.json`, deployed to
  `https://bacteria-wars.wolsok.de/.well-known/assetlinks.json`

Until a fingerprint is listed there, the app still runs, but Chrome shows a
URL bar on top of it. The Gradle build reads the package name from that file,
so it is the one place to change it.

## Releases and Google Play

The app ships with the workspace release, as an Nx `deploy` target like the
other apps. The `Deploy release` workflow runs `nx affected -t deploy` for
every release, in its own `android` leg that compares against the last
`*-android-deployed` tag. When a release touches this folder,
`nx run bacteria-wars-android:deploy` (`tools/bacteria-game/deploy-android.ts`):

1. builds the signed release APK and app bundle, with the version code of the
   release's `version.json`,
2. uploads the bundle to the **internal testing** track on Google Play,
3. attaches the APK and bundle to the GitHub release as
   `bacteria-wars-<tag>.apk` and `.aab`.

Promoting a build to production stays a step in the Play Console. A release
whose bundle is on Play already skips the upload, so a failed deploy can run
again (Actions → Deploy release → Run workflow, with the tag). Web changes do
not ship the app: the app shows the live site, so only changes here need a
new build.

### Store listing

The same deploy brings the Play store listing in line with `store/`:

- `store/listings/<language>/` holds `title.txt`, `short-description.txt`
  and `full-description.txt` for each language (Play takes 30, 80 and 4000
  characters),
- `store/graphics/` holds `icon.png`, `feature-graphic.png` and
  `screenshot-<n>.png`, the same for every language; the landscape
  screenshots serve phones and tablets alike.

Only what differs from Play is sent, images compared by their SHA-256, so an
unchanged listing goes to no review. Since the files sit in this project, a
change to them alone also makes the app affected and ships it with the next
release. The graphics come from the running game:

```bash
npx nx serve bacteria-game-remote                 # in one terminal
npx nx run bacteria-wars-android:store-assets     # in another
```

The matches are live, so every run draws slightly different screenshots:
commit the ones worth showing.

### Play Games Services

The game is a Play Games Services project in the Play Console, on the Cloud
project `bacteria-wars` (the Firebase project of the game). Its Publish page
(Grow users → Play Games Services → Setup and management → Publish) names what
it still needs; `store/` holds all of it:

- **Game details and graphics** (Configuration → Properties) are the store
  listing's: the display name and description from `store/listings/<language>/`,
  the hi-res icon (512 × 512) and feature graphic (1024 × 500) from
  `store/graphics/`. The Publishing API has no way to them, so they go in by
  hand, and again when the listing changes.
- **Achievements** the game lists itself, in
  `libs/features/lazy/bacteria-game/src/lib/state/play-games-achievements.json`
  next to its achievements: every one of them, in the game's order, with its
  points (a multiple of 5, 200 at most, 2000 in all) and its texts per locale.
  The spec beside it fails when the `en-US` texts or the ids drift from the
  game's, so the game's tests guard the file. The deploy creates and updates
  them as drafts through the Play Games Services Publishing API
  (`tools/bacteria-game/play-games.ts`), matched by their English name: an
  achievement renamed in the game is a new one on Play, and the deploy never
  deletes one, since that takes the players' progress on it. Delete the old
  one in the console while it is a draft; once published, Play keeps it for
  good, so rename with care. Drafts go live with the Publish button there. A
  change to the file alone does not ship the app, and the Deploy release
  workflow finds nothing to deploy for it: the achievements reach Play with
  the next release that ships the app, or with
  `npx nx run bacteria-wars-android:deploy` run locally with the secrets of
  the README's setup (the whole Android deploy, not only the sync).
- **Achievement icons** are `store/play-games/achievements/<id>.png`
  (512 × 512, transparent), drawn by

  ```bash
  npx nx run bacteria-wars-android:achievement-icons
  ```

  The API's image upload is gone, so a new or changed icon goes up by hand
  (Achievements → the achievement → Icon); the committed files show in the diff
  which ones.

Without the repository variable `PLAY_GAMES_APPLICATION_ID` the deploy leaves
the achievements alone. Setting up:

1. **The game project**, under Configuration: created on the existing Cloud
   project `bacteria-wars`, with an Android credential for
   `de.wolsok.bacteriawars`. The OAuth client it asks for comes from the
   Firebase app once both SHA-1 fingerprints (the upload key's and the Play
   app signing key's, next to the SHA-256s of `assetlinks.json`) are added to
   it in the Firebase console.
2. **Testers**: your own account, under Testers, until the game is published.
3. **The service account**: on Play Console's API access page, the Game
   Services Publishing API switched on and `play-publisher@...` granted access
   to the game.
4. **The variable**: `PLAY_GAMES_APPLICATION_ID` is the game's project id as
   the Configuration page shows it, the number of its Cloud project
   (`project_number` in `app/google-services.json`).
5. **Publishing**: the OAuth consent screen of the Cloud project published,
   then Publish in the console, at least two hours before a release that
   relies on it.

### Promo video

`store/promo-video/` holds the promo video, as `bacteria-wars-promo-<lang>-<format>.mp4`
(English and German 16:9, English 9:16), and `videos.json` with each one's
YouTube title, description, tags and privacy, and the Play listing it belongs
to. The deploy uploads every video whose file is not on the YouTube channel
yet (see `tools/youtube/README.md`) and sets it as the promo video of its
listing. Without the YouTube secrets it leaves the videos alone.

The videos come from the running game, like the graphics:

```bash
npx nx serve bacteria-game-remote                 # in one terminal
npx nx run bacteria-wars-android:promo-video     # in another
```

`tools/bacteria-game/promo-video/make.ts` plays four clips, records them with
Chrome's screencast, lays them into the scenes of `scenes.html` with the
captions of `copy.json` along `timeline.json`, and adds a synthesised
soundtrack. It needs an ffmpeg with libx264 (`FFMPEG`, the PATH, or
`uvx --from imageio-ffmpeg`).

Set the repository variable `PLAY_RELEASE_STATUS` to `draft` while the app's
Play setup is incomplete: Play then accepts the bundles but holds them back
instead of rolling them out.

The `Android app` workflow can still build the signed artifacts by hand
(Actions → Android app → Run workflow), without publishing them.

### One-time setup

1. An upload key, kept outside the repository:

   ```bash
   keytool -genkeypair -keystore upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. The key in the repository secrets. Locally, the same values go into the
   environment, with `ANDROID_KEYSTORE_FILE` pointing at the keystore instead
   of the base64 secret.

   | Secret                      | Value                   |
   | --------------------------- | ----------------------- |
   | `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 upload.jks` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password   |
   | `ANDROID_KEY_ALIAS`         | `upload`                |
   | `ANDROID_KEY_PASSWORD`      | the key password        |

3. The app `de.wolsok.bacteriawars` in the Play Console with Play App
   Signing. Play takes the first bundle of a new app only through the
   console, so upload one by hand once.

4. A service account that may upload:
   `play-publisher@bacteria-wars.iam.gserviceaccount.com` in the GCP project
   `bacteria-wars`, with the Google Play Android Developer API enabled. Its
   JSON key is the secret `PLAY_SERVICE_ACCOUNT_JSON`. In the Play Console,
   under Users and permissions, invite it with access to the app and the
   permission to release to testing tracks.

5. Both SHA-256 fingerprints in `assetlinks.json`, then a web deploy: the one
   of the upload key (`keytool -list -v -keystore upload.jks`), for APKs
   installed outside Play, and the one of the app signing key from Play
   Console → Test and release → App integrity, for installs from Play.
