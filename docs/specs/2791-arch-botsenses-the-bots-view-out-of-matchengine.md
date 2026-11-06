# Spec #2791: BotSenses, the bots' view out of MatchEngine

Candidate 15 of the architecture analysis of
[#2776](https://github.com/WolfSoko/wol-sok-mono/issues/2776)
(`docs/bacteria-game/architecture-deepening.md`).

## Goal

`MatchEngine` (`libs/features/bacteria-engine/src/lib/state/match-engine.ts`,
1105 lines) builds what the bots see next to input recording, ghosts,
weapons and scoring: the nav grid with its moving walls, the flood cache,
the hill, the weapon view and the bacteria count round a crosshair (about
190 lines plus three caches). It then hands all of it to `buildBotView`
(`bot-controller.ts`) as 15 positional parameters.

Move that world into one deep module, `BotSenses` (`state/bot-senses.ts`),
built once per match from the map, the win rule, the balance, the colony
capacity and the simulation. It owns the caches and answers two questions:

- `viewFor(player, own, colonies, width, height): BotView`, what a bot sees
  when it decides;
- `routesFrom(from, width, height): BotRoutes`, the way round the walls,
  which the neutral colonies take too.

`runBots` shrinks to a loop that asks the senses for a view and acts on the
decision.

## Non-goals

- No change to how a bot decides (`BotController`) or to `BotView`.
- No change to the neutral colonies' minds (`NeutralBrain`), only to where
  their routes come from.
- No other split of `MatchEngine` (recording, ghosts, scoring stay).

## Decisions

- **`viewFor` takes the bot's own colony summary**, not just the player.
  `runBots` must find the colony before it asks `bot.waits(TICK_SEC)`, which
  counts the bot's think timer down: today a bot without a colony never
  counts down, and changing that order would change the matches. Taking
  `own` keeps the lookup where the order is decided and costs no second
  search.
- **The senses depend on a narrow slice of the simulation**:
  `SensedSimulation = Pick<Simulation, 'getNutrients' | 'getDynamicWalls' |
'summaries' | 'blockCounts' | 'nearestEnemy'>`. A spec fakes those five
  calls instead of the whole interface, and the senses cannot step or
  change the war.
- **Same calls, same order.** `viewFor` calls the simulation exactly as
  `buildBotView` did: `getNutrients()` once per view, `nearestEnemy` only
  when an enemy colony is left and the match has no neutral colonies, the
  routes and the weapon count lazily. So `golden-replay.json`, the GPU
  goldens and `SELF_TEST_GOLDEN` stay byte-equal, without a
  `BALANCE_VERSION` bump.
- **`buildBotView`, `neutralFood` and `colonyView` move into
  `bot-senses.ts`** and become private there; `buildBotView` and its 15
  parameters disappear. `bot-controller.ts` keeps the bot's types
  (`BotView`, `BotRoutes`, `BotWeaponView`, `straightRoutes`) and its
  decisions.
- **Prey is worked out per view** from the neutral colonies, instead of once
  per tick for all bots. It is a pure function of the summaries, so the
  result is the same, and a bot decides only a few times a second.
- **The engine keeps its own `unitAt`** for the weapons it fires
  (`launchShots`, `weaponCooldown` does not need it); both are one call of
  `scaleOf(width, map.size)`, the shared function itself.
- **Replace, don't layer:** the `neutralFood` specs in
  `bot-controller.spec.ts` become `viewFor` specs (prey) in
  `bot-senses.spec.ts`.

## Acceptance

1. `state/bot-senses.ts` exports `BotSenses` with `viewFor` and
   `routesFrom`; it owns the nav grid, the flood cache and the hill cache.
   `MatchEngine` has none of them, nor `botWeaponView`, `bacteriaAround`,
   `routesFrom`, `navGridAt` or `hillAt`.
2. `buildBotView` and its 15 positional parameters are gone; nothing
   outside `bot-senses.ts` builds a `BotView` but the specs.
3. `runBots` is at most about 15 lines and builds no view for a bot that
   waits.
4. `bot-senses.spec.ts` tests the view against a fake `SensedSimulation`:
   own and strongest enemy colony, nearest enemy (skipped with neutral
   colonies), prey, feeding on harvest, objective on hold, weapon view and
   its count round the crosshair, routes round a wall and straight on open
   ground, the nav grid kept while the moving walls stand still.
5. `golden-replay.spec.ts`, `golden-match.spec.ts`, the GPU goldens' specs
   (`golden.spec.ts`, `sim-golden.spec.ts`, `self-test-golden.spec.ts`) and
   `match-engine.spec.ts` pass unchanged; no golden file and no
   `BALANCE_VERSION` change.
6. The engine stays Node-only; `feat-shared-bacteria-engine` and
   `feat-lazy-bac-game` test, lint and build green.
7. `CLAUDE.md` needs no change: it does not describe the bots' view (checked).

## Open questions

None.
