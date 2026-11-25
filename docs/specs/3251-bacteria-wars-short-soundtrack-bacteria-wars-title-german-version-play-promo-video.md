# Bacteria Wars Short: soundtrack, Bacteria Wars title, German version, Play promo video

Issue: [#3251](https://github.com/WolfSoko/wol-sok-mono/issues/3251)

## Goal

The Blender Short of [#3248](https://github.com/WolfSoko/wol-sok-mono/pull/3248) (three rod bacteria burst a coccus in a blood vessel, 1080×1920, 13.33 s, 24 fps, silent, title "WAR OF BACTERIA") becomes the game's promo video:

- it gets a soundtrack that follows the picture (tension while the needles stab, an impact on the burst at 6.71 s, a groove after it, a last chord under the end card);
- its title card reads "Bacteria Wars", like the game, and so does its YouTube title;
- a German version exists, with German text on screen and a German YouTube title and description;
- the English Short is the promo video of the en-US Play listing, the German one of de-DE, in place of the generated gameplay promos.

## Non-goals

- Re-rendering the Blender animation (the `.blend` is not in the repo).
- Changing the gameplay promo generator (`make.ts`, its scenes, its soundtrack's sound).
- Passing YouTube's API audit.

## Decisions

1. **Re-edit the MP4 with a script in the repo, not by hand.** `tools/bacteria-game/promo-video/short/short.ts` (Nx target `bacteria-wars-android:promo-short`) writes both versions from the source, so a later text or sound change is a rerun, not another lost ffmpeg cut. The cut of #3248 was not kept; this one is.
2. **The source is the #3248 MP4, moved out of `store/`** to `tools/bacteria-game/promo-video/short/source.mp4` (a `git mv`, no new blob). Only its middle shot (1080×810 at y 554) is used: the script rebuilds the blurred background from that shot (scaled to cover 9:16, blurred, darkened), as the #3248 cut did, so no trace of the old "WAR OF BACTERIA" text is left, and lays the new text over it. Covering the old title with a patch would leave a seam on a moving background.
3. **Text cards are HTML rendered by Playwright** to transparent PNGs (`cards.html`, texts per language in `copy.json`), in the game's faces from the installed Fontsource packages (Bricolage Grotesque for the title, Atkinson Hyperlegible for the rest), like the gameplay promo's `scenes.html`, and faded in by ffmpeg: title at 0.2 s, tagline at 1.0 s, end card at 8.71 s (the bar line after the burst).
   - en: "Bacteria Wars" / "Who swallows whom?" / end card "Bacteria Wars" + "Play it on Google Play and in your browser".
   - de: "Bacteria Wars" / "Wer frisst wen?" / end card "Bacteria Wars" + "Jetzt auf Google Play und im Browser".
4. **The soundtrack is synthesised and seeded**, like the gameplay promo's (`audio.ts`), so a rerun writes the same file and no licence question arises: a heartbeat in the vessel that quickens, a low drone, a zap per needle stab, a noise riser into the burst, an impact with a noise burst at 6.71 s, then 120 BPM in A minor (Am F C, a bar each) with kick, bass and bacteria blips, and the last chord ringing out under the end card, normalised to −14 LUFS. Both versions share it (no speech).
5. **Shared synth helpers move out of `audio.ts`** into `synth.ts` (mixer with panned `add`, seeded random, MIDI to Hz, fade and normalise, 16-bit WAV), and the ffmpeg lookup of `make.ts` into `ffmpeg.ts`, so the Short reuses both instead of copying them. The gameplay soundtrack stays byte for byte the same.
6. **File names** follow the store's scheme: `bacteria-wars-short-en-portrait.mp4`, `bacteria-wars-short-de-portrait.mp4`. `videos.json` drops the War of Bacteria entry; the Short entries carry `listing: en-US` / `de-DE`; the two landscape gameplay promos lose their `listing` and stay on YouTube as videos of their own.
7. **YouTube metadata:** en "Bacteria Wars: who swallows whom? #Shorts", de "Bacteria Wars: Wer frisst wen? #Shorts", descriptions and tags per language, `privacy: public`, `language` `en`/`de`.
8. **The private-upload point is a manual step for the owner.** The API project is unaudited, so the deploy's uploads land private, Studio cannot lift that, and the deploy then leaves the Play listing's video as it is (`promoVideoLinks`). Until the audit passes, the owner uploads each Short by hand in YouTube Studio as public, with its hash tag (`sha256:…`, named in the PR) among the tags, after deleting any private API copy of the same file; the next deploy finds it by that tag and links it from its listing. The deploy's log line for a private video names the file and its tag, so the owner sees what to do. Requesting the audit stays the lasting fix, also for the owner.

## Acceptance

1. The English Short has the soundtrack and a "Bacteria Wars" title card; its YouTube title reads "Bacteria Wars …".
2. A German Short exists with German text on screen, the same soundtrack, and a German YouTube title and description.
3. `videos.json` points en-US to the English Short and de-DE to the German Short; no gameplay promo has a `listing`.
4. Both videos are 1080×1920, 24 fps, H.264 + AAC, about 13.3 s, with no leftover "WAR OF BACTERIA" text (checked on frames).
5. The gameplay soundtrack from `audio.ts` is byte-identical before and after the refactor.
6. The deploy's message for a private video names its tag; the manual step is filed for the owner and named in the PR.
7. `tools` lint and typecheck, format check pass.

## Open questions

- Play recommends landscape promo videos; a portrait YouTube video is accepted and plays letterboxed in the listing. The owner asked for the Short, so it goes in; if the listing looks wrong, the landscape promos can take the listings back by moving `listing` in `videos.json`.
