/**
 * Like `Promise.all`, but lets every promise settle before it throws the
 * first failure - for clean-ups whose steps must all run. The values, in
 * order, typed as `Promise.all` types them.
 */
export async function settleAll<T extends readonly unknown[] | []>(
  values: T
): Promise<{ -readonly [K in keyof T]: Awaited<T[K]> }> {
  const settled = await Promise.allSettled<readonly unknown[]>(values);
  const failed = settled.find(
    (result): result is PromiseRejectedResult => result.status === 'rejected'
  );
  if (failed !== undefined) {
    throw failed.reason;
  }
  return settled.map(
    (result) => (result as PromiseFulfilledResult<unknown>).value
  ) as { -readonly [K in keyof T]: Awaited<T[K]> };
}
