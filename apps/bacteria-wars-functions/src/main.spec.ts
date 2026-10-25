/** The part of a function's manifest entry the specs read. */
interface Endpoint {
  eventTrigger?: { retry?: boolean };
  scheduleTrigger?: { retryConfig?: { retryCount?: number } };
}

describe('the exported functions', () => {
  let functions: Record<string, { __endpoint: Endpoint } | undefined>;

  beforeAll(async () => {
    // A v1 Auth trigger names its project when it is read.
    process.env['GCLOUD_PROJECT'] ??= 'demo-bacteria-functions';
    functions = (await import('./main')) as unknown as typeof functions;
  });

  it('retry only where a lost event would lose a count, or is safe', () => {
    const retrying = Object.entries(functions)
      .filter(([, fn]) => fn?.__endpoint.eventTrigger?.retry === true)
      .map(([name]) => name)
      .sort();
    // rankReplay: a stored replay it fails to rank would never count.
    // rebuildTop: a busy instance turns events away, and a rebuild is safe.
    expect(retrying).toEqual(['rankReplay', 'rebuildTop']);
  });

  it('never retry the hourly run', () => {
    expect(
      functions['hourly']?.__endpoint.scheduleTrigger?.retryConfig?.retryCount
    ).toBe(0);
  });
});
