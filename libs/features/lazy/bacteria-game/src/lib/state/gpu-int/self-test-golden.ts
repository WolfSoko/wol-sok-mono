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
  balanceVersion: 7,
  hashes: [
    1350006642, 987891889, 741610060, 210799722, 1893271071, 1097138395,
    2314103472, 2842135584, 2586487890, 1272775980, 3761620915, 1969635469,
    3256333458, 1933176290, 3840470086, 417200018, 2159471045, 2814256357,
    2648062557, 4233705152,
  ],
} as const;

/**
 * The version of the self-test - a stored result of another one is run
 * again. Bump it with every change to the scenario or its hashes.
 */
export const GPU_SELF_TEST_VERSION = 2;
