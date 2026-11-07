# Spec: one source for the replay playback refusals

Issue: [#2813](https://github.com/WolfSoko/wol-sok-mono/issues/2813), a
follow-up of the altitude review of
[PR #2800](https://github.com/WolfSoko/wol-sok-mono/pull/2800)
([#2781](https://github.com/WolfSoko/wol-sok-mono/issues/2781)).

## Goal

The rule which replays play back lives in one function. Today two places know
the balance clause:

- `canPlayBack(replay)` (`libs/features/bacteria-engine/src/lib/state/replay.ts`)
  checks format, ruleset, balance table, ladder computer and the float GPU,
  and answers only `true`/`false`;
- `replayVerdict(replay)` (`state/replay-verdict.ts`, added by PR #2800)
  checks `header.balanceVersion !== BALANCE_VERSION` again before
  `playReplay`, since it needs to tell the balance mismatch from the other
  refusals, and maps every other `null` of `playReplay` to `unplayable`.

A new engine function names the reason:

```ts
export type PlaybackRefusal =
  'balance' | 'format' | 'ruleset' | 'ladder' | 'gpu';
export function playbackRefusal(replay: Replay): PlaybackRefusal | null;
```

| refusal   | when                                                                    |
| --------- | ----------------------------------------------------------------------- |
| `balance` | `header.balanceVersion !== BALANCE_VERSION`                             |
| `format`  | the header's `version` is unknown or not playable (the ghost format)    |
| `ruleset` | the format does not list the header's `simulation`                      |
| `ladder`  | `header.ladder` is set and is not `LADDER_VERSION`                      |
| `gpu`     | `header.simulation === 'gpu'` (the float GPU never plays back the same) |
| `null`    | it plays back                                                           |

`canPlayBack(replay)` becomes `playbackRefusal(replay) === null`;
`replayVerdict` asks `playbackRefusal` once: `balance` gives
`balance-mismatch`, any other refusal `unplayable`, `null` plays.

## Non-goals

- No change to what any caller sees: `canPlayBack`, `replayEngine`,
  `replayRun`, `playReplay` and `replayVerdict` answer every replay as before
  (the functions' stored states, the game's "My matches", the viewer, the
  gallery).
- The game's notices do not show the reason yet ("My matches" keeps
  `replay.matches.older` for every refusal). A follow-up may use it.
- No change to the tick order: goldens unchanged, no `BALANCE_VERSION` bump.

## Decisions

1. **`playbackRefusal` lives in `replay.ts`, beside `canPlayBack`**, which
   keeps its signature (the game and the functions import it). Reason: the
   version table `VERSIONS` it reads is private to `replay.ts`.
2. **The balance table is checked first.** Reason: `replayVerdict` today
   answers `balance-mismatch` for every replay of another balance table,
   whatever else is wrong with it; checking it first keeps that. Then format,
   ruleset, ladder, GPU, in the order `canPlayBack` checks them.
3. **`replayVerdict` no longer reads `BALANCE_VERSION`.** It calls
   `playbackRefusal` and then `playReplay`; `playReplay` checks again through
   `replayRun`, which is cheap and keeps `playReplay` safe on its own.
4. **Exported from the engine's `index.ts`** with its type, as `canPlayBack`
   is.

## Acceptance

1. `playbackRefusal` names each refusal: another balance table `balance`, the
   ghost or an unknown version `format`, `gpu-int` on a format without it
   `ruleset`, another ladder version `ladder`, the float GPU `gpu`, a
   recorded match `null`; a replay wrong in balance and another way is
   `balance`.
2. `canPlayBack` is `playbackRefusal(replay) === null` and its spec stays
   green unchanged.
3. `replayVerdict` gives `balance-mismatch` for `balance` without playing,
   `unplayable` for every other refusal, and its spec from PR #2800 stays
   green; `replay-verdict.ts` no longer imports `BALANCE_VERSION`.
4. Engine and functions tests, lint, lint-templates and format pass; the
   goldens are unchanged.

## Open questions

None: PR #2800 is on `main`, and this change builds on it.
