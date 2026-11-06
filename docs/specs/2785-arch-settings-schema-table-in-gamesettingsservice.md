# Spec: Settings schema table in `GameSettingsService`

Issue: [#2785](https://github.com/WolfSoko/wol-sok-mono/issues/2785), candidate 9 of
[`docs/bacteria-game/architecture-deepening.md`](../bacteria-game/architecture-deepening.md).

## Goal

Each of the 22 device settings in
`libs/features/lazy/bacteria-game/src/lib/settings.service.ts` is written out five
times: stored field, signal, setter, restore branch and a line in `toStore()`. The
service also persists the match setup, a second job. After this change:

- One table, `SETTINGS`, holds each device setting once: its default, how a stored
  value is read back (`parse`), how a value set by the player is brought into range
  (`normalize`, optional) and whether the statistics report its changes (`reported`).
- A generic `DeviceSettings` engine over that table keeps one signal per key and does
  restore-unless-touched, `set`, `preview` and the stored form once, for every key.
- `StoredMatchSetup` restores and stores the match setup (mode, difficulty, level,
  colours, series, head start) on its own, including the setup that waits for the
  menu while a match is on.
- `GameSettingsService` only wires them up: storage, the statistics, and the two
  settings with side effects (the replay preferences of `GameStateService`, the
  language of `I18nService`).

## Non-goals

- No change to what is stored: the storage key `bacteria-game.settings` and the shape
  of the stored object stay, so stored settings of earlier visits restore as before.
- No change to defaults, validation, the analytics events or any visible behaviour.
- No move of `settings.service.ts` or rename of `GameSettingsService` (30 importers;
  the churn buys nothing).
- No engine change: goldens, `SELF_TEST_GOLDEN` and `BALANCE_VERSION` are untouched.

## Decisions

1. **Public API: `value(key)`, `set(key, value)`, `preview(key, value)`, `loaded`.**
   `value(key)` is a tracked signal read, so templates and `computed`s read
   `settings.value('sound')` as they read `settings.sound()` today. The 21 named setters
   and the 22 public signals go; their call sites move to the generic calls (replace,
   don't layer). `markRecordingHintShown()` becomes `set('recordingHintShown', true)`,
   `previewMusicVolume(v)` becomes `preview('musicVolume', v)`.
   Reason: a new setting then costs one table entry, not five edits and a setter.
2. **The table is typed by its entries.** `SettingValues` (the value type per key) is
   derived from `SETTINGS`, and `StoredSettings` from `SettingValues` plus
   `MatchSetup`, so `value('look')` is a `BacteriaLook` and `set('look', 'x')` fails to
   compile. Reason: strong typing without a hand-kept parallel interface.
3. **`null` is stored as absent.** `arena`, `language` and `matchLevel` hold `null` for
   "none"/"automatic"/"any"; the stored form drops them, as `toStore()` does today.
4. **Normalising lives in the table.** The volumes clamp and round (`clampVolume`), the
   match level falls back to `null` when it plays no online level. `set` and `preview`
   both normalise. Reason: today two setters and two previews do this by hand.
5. **Reported settings are a column of the table.** `REPORTED_SETTINGS` in
   `analytics/setting-change.ts` goes; `settingChange` asks the table. Match-setup keys
   are no device settings and never reach it (today they reach it and return null).
6. **Side effects stay in `GameSettingsService`.** After a `set` or a restore it hands
   `recordLocal`/`saveMatches` to `GameStateService.setReplayPrefs` and `language` to
   `I18nService.setLanguage`, so the engine stays free of the game's services. The
   language is then a plain table setting, mirrored into `I18nService` (the only other
   writer of it is this service today).
7. **The engine is a plain class over signals**, constructed with a table, no DI. Its
   spec runs on the real `SETTINGS` table with one valid and one invalid stored sample
   per key, kept in a fixture typed `Record<SettingKey, …>`, so a new setting fails to
   compile until it has samples. That spec replaces the per-setting tests of
   `settings.service.spec.ts`.

## Acceptance

1. Every device setting is declared once, in `SETTINGS`; `settings.service.ts` holds no
   per-setting signal, setter, restore branch or `toStore()` line.
2. A stored value restores for every key, an invalid one is ignored, a setting the
   player changed before the storage answered keeps the player's value (generic spec
   over the whole table).
3. The stored object has the same keys and values as before for the same settings
   (spec: storing defaults and after changes; `null` settings are absent).
4. `preview` changes the value without persisting or reporting; `set` persists once
   restored and reports a change of a reported setting once, and none when the value
   stays.
5. The match setup restores, waits during a match and a running series, and keeps what
   the player changed, as today (`StoredMatchSetup` spec, moved from the service spec).
6. Replay preferences and language reach `GameStateService` and `I18nService` on set
   and on restore.
7. All call sites use `value`/`set`/`preview`; `npx nx test feat-lazy-bacteria-game`,
   lint, lint-templates, the game's build and its e2e pass.

## Open questions

None blocking. Whether `DeviceSettings` should later move to a shared lib for other apps
is out of scope.
