import { toJsonValue } from './json-compatible';

interface Config {
  name: string;
  rounds: number;
  nested: { enabled: boolean; tags: string[] };
}

describe('json-compatible', () => {
  const config: Config = {
    name: 'Sprint',
    rounds: 3,
    nested: { enabled: true, tags: ['a', 'b'] },
  };

  it('returns the value unchanged as a JSONValue', () => {
    expect(toJsonValue<Config>(config)).toBe(config);
  });

  it('rejects values that JSON cannot hold at compile time', () => {
    // @ts-expect-error a function is not JSON-compatible
    toJsonValue<{ run: () => void }>({ run: () => undefined });
  });
});
