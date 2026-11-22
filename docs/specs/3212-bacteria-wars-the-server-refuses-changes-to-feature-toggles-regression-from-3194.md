# Spec: the server refuses changes to feature toggles ([#3212](https://github.com/WolfSoko/wol-sok-mono/issues/3212))

## Goal

The owner can change and publish the Bacteria Wars feature toggles from the
admin area again, every toggle to `off`, `admin` or `on`, including the new
`bacteriumMenu`.

## Cause

The production logs of the function `adminCommand` show for every
`toggles.set` since the owner tried it on 2026-11-22:

```
Audited action failed  code=remote-config/invalid-argument
message=ETag must be a non-empty string.
```

`withToggles` (`apps/bacteria-wars-functions/src/admin/toggles.ts`) copies
the template with `structuredClone(template)`. The template `getTemplate()`
returns is the Admin SDK's `RemoteConfigTemplateImpl`, a class whose `etag`
is a getter over the private field `etagInternal`. `structuredClone` keeps
own fields only, so the copy has no `etag`, and `publishTemplate` refuses it
before any request.

The bug is as old as the toggles
([#2653](https://github.com/WolfSoko/wol-sok-mono/pull/2653)): the project's
Remote Config has no published version at all, so no `toggles.set` has ever
succeeded. [#3209](https://github.com/WolfSoko/wol-sok-mono/pull/3209)
(#3194) did not cause it, but it was the first time the owner wanted to
change a toggle (`bacteriumMenu`, off by default). The rules (`isToggleArgs`)
and the `STRING` value type are not involved: the command passed the rules
and reached the function. `toggles.spec.ts` built its template as a plain
object with an own `etag`, so it could not see the gap.

## Non-goals

- No change to the toggle states, their texts, the rules or the admin area.
- Reporting a command's `internal` errors to Sentry (they reach only the
  function log, which is why nobody saw this); raised to the manager as a
  follow-up.

## Decisions

- **Copy the template's data, and carry the `etag` over by name.**
  `withToggles` returns a plain `RemoteConfigTemplate`: a deep copy of
  `conditions`, `parameters` and `parameterGroups`, plus `etag` and
  `version` read through the template's accessors. The Admin SDK reads
  exactly those fields on publish, and `withToggles` stays pure and keeps
  the caller's template unchanged.
- **The spec takes the SDK's real template.** It builds its templates with
  `createTemplateFromJSON` of `firebase-admin/remote-config` (on an app
  without credentials), so it holds the class with its getter, as
  production does, and asserts the copy's `etag`.

## Acceptance

1. `withToggles` on a template from the Admin SDK returns a template whose
   `etag` is the original's, with the toggles set as before (text default,
   `STRING`, no conditional values, in their group), and leaves the
   original unchanged.
2. The publish path accepts it: a spec running the real SDK's
   `publishTemplate` input check on `withToggles`' result does not throw
   `ETag must be a non-empty string.` (checked through a `RemoteConfig`
   whose HTTP call is stubbed, or the SDK's validation directly).
3. The first publish carries only the toggles the owner changed: Remote
   Config has never had a published version, so it becomes the first live
   template, and every other toggle keeps its code default for players
   (`setToggles` with every toggle at its default but one sends that one
   parameter only).
4. `npx nx test bacteria-wars-functions` and the functions' lint and
   `typecheck-specs` pass.
5. After the deploy, the owner sets a toggle in `/admin` and it is
   published (Remote Config lists a version, the admin area shows the new
   state); checked by the owner.

## Open questions

None.
