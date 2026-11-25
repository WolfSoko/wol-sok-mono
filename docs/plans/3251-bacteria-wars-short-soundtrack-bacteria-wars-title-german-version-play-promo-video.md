# Plan: Bacteria Wars Short (#3251)

Spec: [docs/specs/3251-…](../specs/3251-bacteria-wars-short-soundtrack-bacteria-wars-title-german-version-play-promo-video.md)

1. **Extract `synth.ts` and `ffmpeg.ts`.** Move the mixer, seeded random, MIDI-to-Hz, fade/normalise and WAV writer out of `audio.ts`, and `ffmpeg()` out of `make.ts`, into `tools/bacteria-game/promo-video/`. Check: the gameplay soundtrack WAV is byte-identical before and after (hash of `soundtrack(…)` with the timeline's arguments), `typecheck-tools`, `lint tools`. Commit `refactor(tools): …`.
2. **Short soundtrack.** `short/short-audio.ts`: heartbeat, drone, stabs, riser, impact at the burst, groove, ring-out, on `synth.ts`. Check: render the WAV, listen-check by its waveform/levels and that it is deterministic. Commit with step 4.
3. **Cards and copy.** `short/cards.html` (title, tagline, end card; transparent; local Fontsource faces) and `short/copy.json` (en, de).
4. **`short/short.ts` and the `promo-short` target.** `git mv` the #3248 MP4 to `short/source.mp4`; render the cards per language with Playwright; ffmpeg rebuilds the background from the middle shot, overlays shot and cards with fades, muxes the soundtrack (−14 LUFS, AAC), writes `store/promo-video/bacteria-wars-short-<lang>-portrait.mp4`. Check: ffprobe (size, fps, duration, streams), contact sheet of frames per language. Commit `feat(bacteria-wars-android): …` with the two videos.
5. **Wire the listings.** `videos.json`: Short entries with `listing` and metadata per language, War of Bacteria entry gone, `listing` off the landscape promos. `deploy-android.ts`: the private-video message names the file's hash tag and the manual way. README (app's promo video section, `tools/youtube` caveat). Check: `deploy-inputs` test (`npx nx test tools`), lint, typecheck. Same commit or one of its own.
6. **Review, test, PR, manual step** for the owner (public upload with the tag), merge request.
