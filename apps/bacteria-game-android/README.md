# Bacteria War for Android

The Android app of the bacteria game. It is a
[Trusted Web Activity](https://developer.chrome.com/docs/android/trusted-web-activity)
(TWA): a thin native shell that opens https://bacteria-game.wolsok.de in
Chrome, fullscreen and without any browser UI. The game itself is the PWA
`bacteria-game-remote`, so every web deploy updates the app as well; only
changes to this folder need a new app release. Offline play, saves, sound and
haptics work as in the installed PWA.

What the shell adds:

- launcher icon (adaptive, with a monochrome layer for themed icons) and a
  splash screen, both drawn by `tools/bacteria-game/generate-icons.ts`
  (`npx nx run bacteria-game-remote:icons`)
- immersive mode, matching `"display": "fullscreen"` of the web manifest
- links to bacteria-game.wolsok.de open in the app
- a WebView fallback for devices without a TWA-capable browser

## Build

Needs JDK 21 and the Android SDK (`ANDROID_HOME`, or `sdk.dir` in
`local.properties`). The Gradle wrapper downloads Gradle itself.

```bash
npx nx run bacteria-game-android:apk               # debug APK
npx nx run bacteria-game-android:apk:release       # release APK
npx nx run bacteria-game-android:bundle            # release app bundle for Play
npx nx run bacteria-game-android:lint-android      # Android lint
```

Outputs land in `app/build/outputs/`. Install a debug APK with
`adb install app/build/outputs/apk/debug/app-debug.apk`.

The version comes from the workspace's `version.json`: 74.44.1 becomes
`versionName` 74.44.1 and `versionCode` 74044001.

The `Android app` GitHub workflow builds and lints the debug APK on every
change to this folder and keeps it as a workflow artifact, to try the app on a
phone. Each run signs it with a fresh debug key, so uninstall the previous one
before installing the next, and expect Chrome's URL bar on top: only keys
listed in `assetlinks.json` get fullscreen. On `main` it also runs for every
release, since the release bumps `version.json` and with it the version code.

## Fullscreen needs Digital Asset Links

Chrome only hides its URL bar when the site and the app vouch for each other:

- the app names the site in its `asset_statements` (set in
  `app/build.gradle.kts`)
- the site names the app's package and the SHA-256 fingerprints of the keys it
  is signed with in
  `apps/bacteria-game-remote/src/.well-known/assetlinks.json`, deployed to
  `https://bacteria-game.wolsok.de/.well-known/assetlinks.json`

Until a fingerprint is listed there, the app still runs, but Chrome shows a
URL bar on top of it. `asset-links.spec.ts` in `bacteria-game-remote-cdk` checks
that package name and host agree on both sides.

## Release signing and Google Play

1. Create an upload key once and keep it safe, outside the repository:

   ```bash
   keytool -genkeypair -keystore upload.jks -alias upload \
     -keyalg RSA -keysize 2048 -validity 10000
   ```

2. Add it to the repository secrets, which the `Android app` workflow uses to
   sign release builds on `main` and manual runs (never on pull requests):

   | Secret                      | Value                   |
   | --------------------------- | ----------------------- |
   | `ANDROID_KEYSTORE_BASE64`   | `base64 -w0 upload.jks` |
   | `ANDROID_KEYSTORE_PASSWORD` | the keystore password   |
   | `ANDROID_KEY_ALIAS`         | `upload`                |
   | `ANDROID_KEY_PASSWORD`      | the key password        |

   Locally, the same values go into the environment, with
   `ANDROID_KEYSTORE_FILE` pointing at the keystore instead of the base64
   secret.

3. Create the app `de.wolsok.bacteriagame` in the Play Console with Play App
   Signing and upload the `.aab` from the workflow's `bacteria-war-release`
   artifact.

4. Put both SHA-256 fingerprints into `assetlinks.json` and deploy the web
   app: the one of the upload key (`keytool -list -v -keystore upload.jks`),
   for APKs installed outside Play, and the one of the app signing key from
   Play Console → Test and release → App integrity, for installs from Play.
