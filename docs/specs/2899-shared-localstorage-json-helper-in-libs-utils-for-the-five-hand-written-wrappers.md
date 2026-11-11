# Spec #2899: Shared localStorage JSON helper in libs/utils for the five hand-written wrappers

Issue: [#2899](https://github.com/WolfSoko/wol-sok-mono/issues/2899), found
by `/simplify` on [PR #2897](https://github.com/WolfSoko/wol-sok-mono/pull/2897)
([#2867](https://github.com/WolfSoko/wol-sok-mono/issues/2867), part of
[#2861](https://github.com/WolfSoko/wol-sok-mono/issues/2861)). Related:
[PR #2754](https://github.com/WolfSoko/wol-sok-mono/pull/2754).

Names as of the spec's writing; since [#3053](https://github.com/WolfSoko/wol-sok-mono/pull/3053) the selection lib is `feat-korbjaeger-selection` (`LokaleAuswahl` is `LocalSelection` in `local-selection.ts`, `auswahl-dokument.ts` is `selection-document.ts`) and `LokaleLetzteAntworten` is `LocalAnswerCache` (`feat-korbjaeger-answers`).

## Goal

One rule for keeping data in the browser's `localStorage`: a read of a
storage that is missing (server), blocked (private mode, site data off) or
holds unreadable JSON counts as nothing stored; a write that the storage
refuses keeps nothing and fails nothing, but tells the caller whether it was
kept and, where it matters, that the storage is full; another tab's change
to a key is heard through one `storage`-event watch. The rule lives in
`@wolsok/utils-browser-storage` (`libs/utils/browser-storage`, which already
holds `isStorageFull`), and every hand-written wrapper the issue names uses
it instead of its own `try`/`catch`.

## Non-goals

- No stored key, value or format changes: what each app wrote before reads
  the same after (no migration).
- `LokaleLetzteAntworten` (`feat-korbjaeger-antworten`) keeps its own write
  loop: it evicts per failed attempt and already shares `isStorageFull`.
- The game's Web Lock (`LocalGameStorage.update`) stays in the game: it is
  the game's concurrency rule, not a storage rule.
- No RxJS or Angular in the helper: `utils` keep minimal dependencies; the
  game turns the watch into its `Observable` itself.
- No change to `sessionStorage` or IndexedDB users.

## Decisions

- **Home: `libs/utils/browser-storage`**, not `libs/utils/json`. The helper
  is about the storage (blocked, full, events); JSON is one form of value.
  The lib already exists, is tagged `utils` and is imported by the
  Korbjäger libs.
- **The storage is a parameter, never a default.** Every function takes
  `storage: KeyValueStorage | undefined` (`Pick<Storage, 'getItem' |
  'setItem' | 'removeItem'>`). A default parameter would turn an explicit
  `undefined` ("this device has none") into `localStorage`, and specs pass
  fakes anyway. Callers in the browser pass `deviceStorage()`.
- **`deviceStorage()` reads `window.localStorage` only where a `window`
  exists**, and returns `undefined` where the access throws (blocked site
  data). A server runtime with a global `localStorage` of its own (Node's
  Web Storage) would share it across every request; through `window` it is
  never touched. This replaces Korbjäger's `geraeteSpeicher` and the
  `typeof localStorage` checks of the theme and the portfolio, and lets
  RollaPolla's store drop its platform check.
- **Writes report a `StoreOutcome`: `'stored' | 'full' | 'refused'`.**
  Most callers ignore it; `LokaleAuswahl` needs `full` to make room and
  retry, and `'stored'` to clear its pending changes. `null` as the value
  removes the entry.
- **`JSON.stringify` is not guarded.** A value that is no JSON is a bug of
  the caller and surfaces; only the storage's refusal is swallowed.
- **`parseJson(text)`** in `@wolsok/utils-json` (moved from the game's
  `stored-json.ts`, which goes; first planned as `parseStoredJson` in the
  storage lib, moved after `/simplify`, since the game's network messages
  and Firestore backend parse with it too) reads `null` for none or
  unreadable text; `readStoredJson` is `parseJson(readStored(…))`. Callers
  check the shape themselves.
- **`watchStored(key, onChange, target)` returns its stop function.** It
  calls `onChange` for a `storage` event of `key` and for a cleared storage
  (`key === null`), the filter the game and `LokaleAuswahl` each wrote.
  `target` is a parameter (`Pick<EventTarget, …> | undefined`), so specs and
  the server pass their own or none.
- **The wrappers stay where their domain is**; only their storage handling
  moves. `readStored`/`writeStored` of the theme and the portfolio, two
  identical copies, are deleted; Korbjäger's `flagGesetzt`/`flagSetzen`
  keep their names and become one-liners over the lib.

## Acceptance

1. `@wolsok/utils-browser-storage` exports `deviceStorage`, `readStored`,
   `writeStored`, `readStoredJson`, `writeStoredJson`,
   `watchStored`, the types `KeyValueStorage`, `StoreOutcome`, and still
   `isStorageFull`; its spec covers: no storage, a throwing storage, a full
   storage (`full`), another refusal (`refused`), removal by `null`,
   unreadable JSON, the watch's key filter, a clear, and stopping.
2. `libs/shared/theme` and `apps/portfolio` have no `stored-choice.ts`;
   their services read and write through the lib, and their specs pass.
3. `libs/shared/analytics`' `loadChoice`/`saveChoice` use the lib.
4. The game's `LocalGameStorage` reads, writes and watches through the lib;
   `stored-json.ts` is gone and its users import `parseJson` from
   `@wolsok/utils-json`; the game's specs pass.
5. RollaPolla's `VotedPollsStore` reads and writes through the lib.
6. Pacetrainer's `Repository` reads and writes through the lib.
7. Korbjäger: `geraeteSpeicher` is replaced by `deviceStorage`;
   `flagGesetzt`/`flagSetzen` and `LokaleAuswahl` (read, write with its
   make-room retry, watch) use the lib; the `auswahlVertrag` contract and
   every Korbjäger spec pass.
8. No `localStorage.getItem`/`setItem`/`removeItem` call wrapped in its own
   `try` is left in the five wrappers the issue names, the theme's copy or
   the pacetrainer `Repository`.
9. `npx nx affected -t lint,lint-templates,test,typecheck-specs` is green;
   the federated builds still build (`bacteria-game-remote`,
   `angular-examples`).

## Open questions

None.
