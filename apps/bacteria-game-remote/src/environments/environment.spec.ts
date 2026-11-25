import { environment as development } from './environment';
import { environment as e2e } from './environment.e2e';
import { environment as emulator } from './environment.emulator';
import { environment as production } from './environment.prod';

describe('error reports', () => {
  it('start only on the live site', () => {
    expect(production.sentry).toEqual({
      dsn: expect.stringMatching(
        /^https:\/\/\w+@o1384048\.ingest\.us\.sentry\.io\/\d+$/
      ),
      environment: 'production',
      release: expect.stringMatching(/^bacteria-wars@v\d+\.\d+\.\d+$/),
    });
    for (const environment of [development, emulator, e2e]) {
      expect(environment.sentry).toBeUndefined();
    }
  });
});
