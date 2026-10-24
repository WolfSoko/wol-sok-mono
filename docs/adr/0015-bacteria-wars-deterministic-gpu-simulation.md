# 15. Bacteria Wars: a deterministic GPU simulation

- Status: proposed
- Date: 2026-10-24
- Scope: `libs/features/lazy/bacteria-game` (`gl/`, `state/`), the coming
  functions app (ADR 0011), CI (ADR 0014)

## Context

The game has two simulations with different rules:

- **The CPU simulation** (`state/bacteria-simulation.ts`) moves bacteria one
  after the other. It is deterministic: online lockstep (ADR 0009), replays,
  ranked matches and the server's verification (ADR 0011, 0012) all run on
  it.
- **The GPU simulation** (`gl/gpu-simulation.ts`, `gl/simulation-shaders.ts`)
  lets every free cell claim one of the bacteria that want to move into it,
  then applies the claims. It is far faster and runs local play on most
  devices, but it is not deterministic: its intents and energy updates use
  float maths that differ between GPUs.

Recording a local match therefore switches it to the CPU, which is slower
and whose medal limits for the generated levels are not checked. "Record
local matches" is off by default for that reason (PR #2596).

A spike (2026-10-24) tested whether the GPU simulation can be made
deterministic:

- **Integer-only movement matched bit for bit.** An integer-only version of
  the movement passes (influence, hunt, claim, apply) on a 320×180 online
  grid with walls, ice, heat and 4 colonies gave identical state hashes on
  every frame:
  - ANGLE on SwiftShader (Vulkan);
  - ANGLE on Mesa llvmpipe;
  - Firefox's WebGL on llvmpipe;
  - a bit-exact TypeScript reference in Node.

  It held for 1,200 claim/apply steps with 6k bacteria and 600 steps with
  36k bacteria.

- **The float version does not match.** The production float maths of the
  same passes differed between SwiftShader and llvmpipe:
  - `atan` gave different bits on 97% of texels;
  - the octant pick differed on 2 texels per million;
  - the combat energy update differed on 29 per million.

  At game scale that desyncs within a few dozen ticks.

- **The shaders are not the only source of drift.** The CPU side of the GPU
  simulation follows readback timing:
  - the division budget (`stepsBehind`);
  - pellet draining;
  - colony summaries;
  - the active area.

  The seed is only the step count, with no match seed.

- **A CPU port is slow.** The TypeScript reference costs about 5 ms per
  movement step at 6k bacteria (3 steps per tick), against about 4 ms for
  the CPU simulation's whole tick. A full port would verify a 3-minute match
  in roughly 3–8 minutes untuned. That is fine for the server, borderline
  for replays, and unusable for live play.

## Decision

The GPU simulation becomes a deterministic ruleset of its own:

1. **Integer-only shaders.** All state stays integer:
   - energy is Q14 throughout;
   - random draws are compared as 32-bit uints against thresholds computed
     on the CPU;
   - directions are fixed-point vectors with an exact integer square root,
     and the octant is picked by integer cross products. This replaces
     `atan`, and its average step points exactly along the direction;
   - every uniform that feeds the state is a fixed-point integer with a
     written-down bound below 2^31, since GLSL ES 3.00 has no 64-bit
     multiply;
   - every state-relevant intermediate (Q14 products, cross products,
     energy sums) has a written-down bound below 2^31 too, so no value ever
     wraps. Products round by an arithmetic right shift (towards minus
     infinity) on both sides: `>>` on `int` in GLSL, `>>` on an
     `Math.imul` result in TypeScript, so the two agree bit for bit;
   - no signed division or modulo.

   The bounds are part of the code: each Q-format helper names its range,
   and the TypeScript reference asserts it in tests. The CI cross-check
   (decision 4) includes scenarios that drive energy, counts and vectors to
   these bounds.

   Painting stays float; it never feeds back into the state.

2. **A deterministic data flow between CPU and GPU.** Nothing the state
   depends on may follow readback timing. This covers the division budget,
   pellet eating, colony counts and the active area. Each is computed on the
   GPU from that tick's state, or read back at a fixed lag of k ticks. The
   active area is either proven to cover everything that can change, or
   deterministic mode runs the full grid.

   Random draws follow one contract on the GPU, in the TypeScript reference
   and on the server. Each draw hashes the cell and a salted frame seed:
   `pcg3d(x, y, frameSeed ^ salt * 0x9E3779B1)`. That is the PCG-based 3D
   hash the spike used (Jarzynski and Olano), in 32-bit unsigned arithmetic,
   returning `x ^ y ^ z`. `frameSeed` mixes the match seed (`MatchPlan.seed`,
   carried in the replay header and the online handshake) with the step
   number. Each pass names its salts as constants, so no draw depends on the
   order in which cells are visited.

3. **A bit-exact TypeScript reference of every pass.** It is pure, part of
   `engine.ts`, and runs in Node. The server's verification and CPU replays
   use it.
4. **CI cross-checks the two.** A Playwright spec runs the GLSL passes on
   SwiftShader (and llvmpipe where available) against the TypeScript
   reference, with golden hashes per `BALANCE_VERSION`. The CPU benchmark of
   ADR 0014 gains a fixture for the reference.
5. **An on-device self-test.** At start the game runs a small set of test
   vectors on the GPU and compares each result with a hash baked in at build
   time. Together the vectors cover every state-relevant pass (movement,
   escape, division, combat, feed, weapons, pellets) and the written bounds
   of decision 1: energy at its maximum, the largest counts, and walls and
   zones at the grid's edges. They are taken from the CI cross-check's
   scenarios and take well under a second. If any hash differs, the device
   uses the CPU simulation for recorded, ranked and online play. The result
   is cached per device and GPU driver string, and the test runs again when
   either changes.
6. **Replays and the network know the ruleset.** A replay header and the
   online handshake name the simulation ruleset (`cpu` or `gpu-int`). Each
   seat offers the rulesets it can run, and the match takes `gpu-int` only
   if both offer it, otherwise `cpu`. This is settled in the handshake,
   before the first tick. Every seat can run `cpu`, so a match never fails
   over the ruleset.

   Ranked boards stay CPU-only until their policy is decided. Before step 8
   enables `gpu-int` for ranked play, either each ruleset gets its own
   boards, or one ruleset is chosen for all ranked entries.

   Decided with step 8 (the owner): one ruleset for all ranked entries,
   `gpu-int`. A ranked attempt is only taken from a `gpu-int` replay, so
   ranked play needs a device whose GPU passed the self-test. A device that
   failed it, or has no WebGL2, plays the `cpu` ruleset only, and offers
   only `cpu` online; `IntSimulation` replays and checks matches, it does
   not play them live.

## Consequences

- Recorded, ranked and online matches can run on the GPU on devices that
  pass the self-test. "Record local matches" can then be on by default
  without slowing local play.
- The movement changes slightly:
  - oblique moves are up to about 3.5% slower, at mid-angles;
  - diagonal steps are up to about 9 percentage points rarer;
  - the average direction gets more exact, where the float pick was biased
    by up to 4°.

  Together with the fixed-point energy rounding this needs a
  `BALANCE_VERSION` bump, new golden replays, and a new check of the medal
  limits for the GPU ruleset.

- Two rulesets stay in the game, each with its own balance checks and golden
  replays. Moving the CPU simulation to the claim/apply rules would leave
  one ruleset; that is a separate decision.
- Old mobile GPU drivers with integer bugs fall back to the CPU through the
  self-test. They cannot desync a match, but they lose GPU speed for
  recorded play.
- The server verifies GPU matches through the TypeScript reference. That
  costs more CPU than a CPU-ruleset match and has to fit ADR 0012's
  verification budget, so the reference gets a tuned version (occupied cells
  only, inlined hashing, possibly WASM).

## Rollout

Each step is a PR. Steps 1–5 change no gameplay while the deterministic path
sits behind a flag; step 8 switches it on.

1. Integer common code: draws, thresholds, Q-format uniforms on the CPU.
2. Movement, escape and division intents and apply, from the spike into
   production.
3. Combat and feed in fixed point, with written bounds.
4. Weapons and pellets as integers.
5. A deterministic CPU↔GPU data flow, as described in decision 2. This step
   carries the most risk.
6. The full TypeScript reference, the Playwright cross-check and golden
   hashes in CI.
7. The on-device self-test and the CPU fallback. As built:
   - `GridSimulation` (`state/grid-simulation.ts`) holds what both
     simulations run on the CPU - walls, zones, pellets, effects, the frame's
     uniforms and what a report means. `GpuSimulation` adds the shader
     passes; `IntSimulation` (`state/gpu-int/int-simulation.ts`) runs
     `intReferenceTick` and `intReport`, the report pass in TypeScript. So
     `IntSimulation` is the `gpu-int` ruleset on the CPU, bit for bit.
   - The self-test (`gl/gpu-self-test.ts`) plays one small whole match
     (`SELF_TEST_SCENARIO`: 48 x 32 cells, 16 ticks, every zone, a sliding
     wall, every weapon, pellets) through the real `GpuSimulation` and
     compares each tick's hash of state and scoreboard with
     `SELF_TEST_GOLDEN`. That checks the uniforms and pass order too, which
     separate test vectors would miss. The written bounds of decision 1 stay
     with the CI cross-check's `bound-extremes`. `GpuSelfTestService` runs it
     once per page session and keeps the verdict in `DeviceStorage`, keyed by
     test version, `BALANCE_VERSION`, renderer string and user agent.
   - `chooseSimulation` (`gl/simulation-choice.ts`) takes the integer GPU
     simulation for a GPU that passed, `IntSimulation` otherwise, and falls
     back to `IntSimulation` when a GPU simulation fails to start. It is
     behind `DETERMINISTIC_SIMULATION`, still false.
   - CI plays three whole-match scenarios through `GpuSimulation` on
     SwiftShader against `golden-gpu-sim.json`, which `sim-golden.spec.ts`
     keeps equal to `IntSimulation`'s hashes, and runs the self-test there.
   - Open for step 8: `IntSimulation` was too slow for live play here, at
     21-28 ms per tick at 320 x 180 cells in Node on a desktop (an earlier
     run measured about 70 ms), against 16.7 ms per tick at 60 ticks a
     second. Step 9 brought it to about 7-9 ms (see below); a phone is
     slower, so until it is measured on one, a device without a passing GPU
     (or before its verdict is in) should still offer only the `cpu`
     ruleset in the handshake, as decision 5 says.
8. Switch it on. Done:
   - `BALANCE_VERSION` is 6 and `NET_VERSION` `3/6` (the handshake changed
     too). The CPU's rules did not change: the CPU goldens keep their
     values under version 6.
   - Every simulation names its ruleset (`Simulation.ruleset`: `cpu`,
     `gpu-int`, or null for the float GPU one). Replay version 5
     (`GPU_INT_REPLAY_VERSION`, after ADR 0016 took 4 for the ladder) holds `gpu-int` matches, plain or evolved;
     `playReplay` plays them on `IntSimulation`. Old `gpu` recordings stay
     version 1 or 3, good for a ghost race only.
   - The handshake: each `hello` carries the rulesets the device offers
     (`r`), the host's `start` the agreed one (`agreedRuleset`: `gpu-int`
     only if both offer it), and a guest refuses a start on a ruleset both
     did not offer. `PlayerService` plays an online match on the agreed
     ruleset - the integer GPU passes, or `IntSimulation` should they fail
     to start, so the ruleset holds.
   - The ranked policy (decision 6): a stored replay with an attempt must
     be `gpu-int`. There is no ranked queue to gate yet; the matchmaking
     queue is casual (ADR 0010) and pairs any two devices, which agree on a
     ruleset in the handshake.
   - Local matches, recorded or not, play `gpu-int` where the GPU passed the
     self-test, `cpu` else (`chooseSimulation`). A GPU simulation that fails
     to start leaves the device on `cpu`, offering `cpu` only.
   - The golden replay has a `gpu-int` result as well
     (`golden-replay.spec.ts`), played on `IntSimulation`.
   - The medal limits stay as they are for now. A first look - normal bot
     against normal bot, three seeds, capped at 150 s, at the online grid -
     settles nothing: on Petri Dish the `cpu` ruleset won twice (50 s,
     106 s) and ran into the cap once, `gpu-int` ran into the cap all three
     times; on Corridors both ran into it every time. The limits were taken
     from hard against normal, which the engine cannot set per seat, so the
     real check is a playtest on a device that passed the self-test, and
     ranked `gpu-int` play. Revisit them before the boards open.
   - "Record local matches" is on by default once `DETERMINISTIC_SIMULATION`
     is: while the switch is off a recorded match still plays on the CPU, so
     the default follows the switch.
   - `DETERMINISTIC_SIMULATION` stays off until the owner's real-device
     check passed; turning it on is a one-line change. Meanwhile a device
     opts in with `?sim=gpu-int`: it runs the self-test, plays local
     matches on the integer GPU passes whatever the self-test said and
     shows the ruleset and the self-test's verdict in the settings under
     "Screen". `?sim=cpu` forces the CPU, `?sim=auto` clears the override
     (`SimulationOverrideService`, kept in `DeviceStorage`). While the
     switch is off a device offers only `cpu` online, opted in or not; once
     it is on, the override still changes local play only.
9. Tune the CPU reference for the server. Done for a first round, bit for
   bit (every golden unchanged):
   - the passes read module-local copies of their constants and helpers,
     as a CommonJS build reads every imported binding through a getter;
   - claim and apply keep a free-cell map per step, take the step's salts
     once and check the neighbours of inner cells without bounds tests;
     combat and feeding loop over typed neighbour tables, and feeding skips
     empty cells;
   - `IntSimulation` passes its states and reports through reused buffers
     (`IntStateBuffers`, a ring of report buffers) and refills the
     painter's bacteria objects once per tick instead of building new ones
     every frame.

   `libs/features/lazy/bacteria-game/perf/int-simulation.bench.ts` prints the time per tick: in Node
   on a desktop 96 x 64 went from 3.5-4.7 ms to about 2 ms, 320 x 180 from
   21-28 ms to 7-9 ms. A phone and the server's runtime still need a
   measurement of their own. The functions' re-run benchmark (ADR 0012)
   measured it next to the `cpu` ruleset in Node on a dev VM: 2.1 times
   its CPU a tick at worst on the online grid, so the server charges a
   `gpu-int` re-run 2.5 times its ticks (`GPU_INT_COST`).

The spike's code (integer movement shaders, the TypeScript reference, the
cross-check across SwiftShader, llvmpipe and Firefox) is not part of this
ADR. Steps 1–2 bring it into the repository, from `gl/spike/` on the spike
branch.
