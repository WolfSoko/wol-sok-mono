# Bacteria Wars: serve app-ads.txt for AdMob

Issue: [#3078](https://github.com/WolfSoko/wol-sok-mono/issues/3078)

## Goal

AdMob verifies an app's ad sellers through `app-ads.txt` (IAB Tech Lab spec) at the root of the developer website its Google Play listing names. Serve that file, holding exactly the AdMob line, so AdMob can verify the Bacteria Wars app:

```
google.com, pub-6346271540341424, DIRECT, f08c47fec0942fa0
```

## Non-goals

- No AdMob SDK or ads in the Android app (`apps/bacteria-wars-android`): the file only.
- No change to `ads.txt` on wolsok.de or to the web game's ad networks.
- No change to the Play listing itself.

## Decisions

- **Both domains** (manager, grilling round 1): the Play listing's developer website is not in the repo, so the file goes to `https://bacteria-wars.wolsok.de/app-ads.txt` and `https://wolsok.de/app-ads.txt`. Whichever the listing names, AdMob finds it.
- **Exactly one line**, the same as `wolsok.de/ads.txt`.
- **bacteria-wars.wolsok.de**: a static asset of `bacteria-game-remote` (`src/app-ads.txt`, listed in the `esbuild` target's `assets`). Firebase Hosting serves files before rewrites, and its `**` header already sends `Cache-Control: no-cache`. The service worker leaves it alone: it is in no asset group, and `navigationUrls` skip paths with an extension.
- **wolsok.de**: `apps/portfolio/public/app-ads.txt`, copied into the build like `ads.txt`, and named in `portfolio-cdk`'s `noCacheFiles` beside `ads.txt`, since crawlers read it by name.
- **Guard by specs**: the game's spec checks the file holds the line and is listed in the assets; the portfolio's spec checks its copy holds the same line as `ads.txt`.
- The Android README notes that `app-ads.txt` is served for AdMob's verification while the app itself serves no ads.

## Acceptance

1. `nx build bacteria-game-remote` output contains `app-ads.txt` with exactly the line.
2. `nx build portfolio` output contains `app-ads.txt` with exactly the line.
3. `portfolio-cdk` lists `app-ads.txt` in `noCacheFiles`.
4. Specs fail when either file is missing, holds another line, or the game's asset entry is gone.
5. The Android README names the file and why it is served.
6. After deploy, both URLs answer 200 with the line (checked after release).

## Open questions

None: the manager decided the domain question (both) in grilling round 1.
