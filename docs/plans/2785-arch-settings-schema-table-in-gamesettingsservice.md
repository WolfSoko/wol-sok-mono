# Plan: Settings schema table in `GameSettingsService`

Spec: [`docs/specs/2785-arch-settings-schema-table-in-gamesettingsservice.md`](../specs/2785-arch-settings-schema-table-in-gamesettingsservice.md).
All paths below are under `libs/features/lazy/bacteria-game/src/lib/`.

1. **Settings table.** `settings/setting-table.ts`: `SettingSpec<T>`
   (`default`, `parse`, `normalize?`, `reported?`), `SETTINGS` with the 22 device
   settings and their docs, `SettingKey`, `SettingValues`, `StoredDeviceSettings`,
   the volume constants and `clampVolume`/`isVolume`.
   Test: `settings/setting-table.spec.ts` (normalising volumes and match level,
   parse of each kind). Commit: `refactor(feat-lazy-bacteria-game): declare the device settings in one table`.
2. **Generic engine.** `settings/device-settings.ts`: `DeviceSettings<T>` with
   `value`, `set`, `preview`, `restore(stored)`, `toStore()`, `touched`.
   Test first: `settings/device-settings.spec.ts` over the real table with a
   `Record<SettingKey, {valid, invalid}>` sample fixture (restore, invalid ignored,
   touched kept, `null` stored as absent, `preview` not marked touched).
   Commit: `refactor(feat-lazy-bacteria-game): restore and store the device settings generically`.
3. **Match setup.** `settings/stored-match-setup.ts`: `StoredMatchSetup`
   (restore, the pending setup during a match/series, `toStore()`, touched keys, the
   change stream of the game store). Test: `settings/stored-match-setup.spec.ts`,
   moving the match-setup tests out of `settings.service.spec.ts`.
   Commit: `refactor(feat-lazy-bacteria-game): persist the match setup on its own`.
4. **Wire the service.** `settings.service.ts` composes both, keeps storage,
   analytics, replay prefs and language; `analytics/setting-change.ts` takes
   `reported` from the table. `settings.service.spec.ts` shrinks to storage
   (late answer, broken JSON, persist only after restore), analytics and side
   effects. Commit: `refactor(feat-lazy-bacteria-game): build GameSettingsService on the settings table`
   (together with step 5, since the old API goes in it).
5. **Move the call sites** in components, services, templates and their specs to
   `value`/`set`/`preview` (`menu/settings.component.*`, `sound/`, `haptics`,
   `stage/`, `hud/`, `campaign`, `evolution`, `flow/`, `menu/`, `replays/`,
   `analytics/user-properties.ts`, `bacteria-game.component.*`).
6. **Checks.** `npx nx test feat-lazy-bacteria-game`, `nx lint`/`lint-templates`
   on the lib and remote, `nx run bacteria-game-remote:build`, the remote's e2e;
   `nx format:write`, oxfmt at the pinned version.
