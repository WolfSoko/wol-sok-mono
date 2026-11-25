import { environment as development } from './environment';
import { environment as production } from './environment.prod';

describe('error reports', () => {
  it('go to the Sentry project angular-examples from production only', () => {
    expect(production.sentry).toEqual({
      dsn: 'https://d7eab9a5f3484e48b3cf9c110533dcbe@o1384048.ingest.sentry.io/6702682',
      environment: 'production',
      release: expect.stringMatching(/^angular-examples@v\d+\.\d+\.\d+$/),
    });
    expect(development.sentry).toBeUndefined();
  });
});
