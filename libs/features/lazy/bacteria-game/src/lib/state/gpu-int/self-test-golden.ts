/**
 * The TypeScript reference's hashes of `SELF_TEST_SCENARIO`, tick by tick,
 * for this balance version: what a GPU has to land on to pass the
 * self-test (`gl/gpu-self-test.ts`). Kept here rather than worked out on
 * the device, where the reference would cost more than the test itself.
 * `self-test-golden.spec.ts` keeps them in line with `IntSimulation`; when
 * the integer passes or the balance change, write what it reports here and
 * bump {@link GPU_SELF_TEST_VERSION}.
 */
export const SELF_TEST_GOLDEN = {
  balanceVersion: 5,
  hashes: [
    3623769593, 1335942377, 3917891690, 3743585950, 3012036801, 4257550493,
    2626131959, 1969862884, 2604988264, 2463325698, 3596699058, 56228383,
    719712253, 3765316942, 3030339261, 3422429831,
  ],
} as const;

/**
 * The version of the self-test - a stored result of another one is run
 * again. Bump it with every change to the scenario or its hashes.
 */
export const GPU_SELF_TEST_VERSION = 1;
