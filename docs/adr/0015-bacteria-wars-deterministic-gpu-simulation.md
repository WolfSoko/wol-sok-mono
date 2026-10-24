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
   - no signed division or modulo.

   Painting stays float; it never feeds back into the state.

2. **A deterministic data flow between CPU and GPU.** Nothing the state
   depends on may follow readback timing. This covers the division budget,
   pellet eating, colony counts and the active area. Each is computed on the
   GPU from that tick's state, or read back at a fixed lag of k ticks. The
   active area is either proven to cover everything that can change, or
   deterministic mode runs the full grid. The match seed is mixed into every
   draw.
3. **A bit-exact TypeScript reference of every pass.** It is pure, part of
   `engine.ts`, and runs in Node. The server's verification and CPU replays
   use it.
4. **CI cross-checks the two.** A Playwright spec runs the GLSL passes on
   SwiftShader (and llvmpipe where available) against the TypeScript
   reference, with golden hashes per `BALANCE_VERSION`. The CPU benchmark of
   ADR 0014 gains a fixture for the reference.
5. **An on-device self-test.** At start the game runs a fixed scenario of
   about 50 steps on the GPU and compares the result with a hash baked in at
   build time. If they differ, the device uses the CPU simulation for
   recorded, ranked and online play.
6. **Replays and the network know the ruleset.** A replay header and the
   online handshake name the simulation ruleset (`cpu` or `gpu-int`), and
   both seats must agree. Ranked boards accept both but compare like with
   like, or one ruleset is chosen for ranked play when the boards ship.

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
7. The on-device self-test and the CPU fallback.
8. Switch it on:
   - bump `BALANCE_VERSION` and `NET_VERSION`;
   - add the ruleset to replays and the online handshake;
   - update the golden replays;
   - check the medal limits;
   - turn "Record local matches" on by default.
9. Tune the CPU reference for the server.

The spike's code (integer movement shaders, the TypeScript reference, the
cross-check across SwiftShader, llvmpipe and Firefox) is not part of this
ADR. Steps 1–2 bring it into the repository, from `gl/spike/` on the spike
branch.
