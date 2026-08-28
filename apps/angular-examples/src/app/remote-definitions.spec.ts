jest.mock('@module-federation/enhanced/runtime', () => ({
  registerRemotes: jest.fn(),
}));

const DEFINITIONS = [
  { name: 'fourier-analysis-remote', entry: 'https://example.com/a.json' },
  { name: 'bacteria-game-remote', entry: 'https://example.com/b.json' },
];

describe('registerRemotesOnce', () => {
  let fetchMock: jest.Mock;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    fetchMock = jest
      .fn()
      .mockResolvedValue({ json: async () => DEFINITIONS } as Response);
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  /**
   * `jest.resetModules()` gives every test a fresh module registry so the
   * memoized registration starts over - the runtime mock has to be pulled from
   * that same registry.
   */
  async function importSut() {
    const [{ registerRemotesOnce }, { registerRemotes }] = await Promise.all([
      import('./remote-definitions'),
      import('@module-federation/enhanced/runtime'),
    ]);
    return {
      registerRemotesOnce,
      registerRemotes: registerRemotes as jest.Mock,
    };
  }

  it('registers the remotes from the manifest', async () => {
    const { registerRemotesOnce, registerRemotes } = await importSut();

    await registerRemotesOnce();

    expect(fetchMock).toHaveBeenCalledWith(
      '/assets/module-federation.manifest.json'
    );
    expect(registerRemotes).toHaveBeenCalledWith(DEFINITIONS, { force: true });
  });

  it('registers the remotes only once, no matter how many routes ask', async () => {
    const { registerRemotesOnce, registerRemotes } = await importSut();

    await Promise.all([
      registerRemotesOnce(),
      registerRemotesOnce(),
      registerRemotesOnce(),
    ]);
    await registerRemotesOnce();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(registerRemotes).toHaveBeenCalledTimes(1);
  });

  it('does not register anything on import', async () => {
    // The remotes must stay unregistered until a lazy route pulls one in.
    // Registering them up front initialises every remote container before the
    // host owns the shared @angular/core entry, which ends in NG0908.
    const { registerRemotes } = await importSut();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(registerRemotes).not.toHaveBeenCalled();
  });
});
