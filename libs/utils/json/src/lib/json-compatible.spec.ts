import {
  safeJsonParse,
  safeJsonStringify,
  toJsonValue,
} from './json-compatible';

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

  it('round-trips a JSON-compatible value through stringify and parse', () => {
    const text = safeJsonStringify<Config>(config);

    expect(safeJsonParse(text)).toEqual(config);
  });

  it('returns the value unchanged as a JSONValue', () => {
    expect(toJsonValue<Config>(config)).toBe(config);
  });

  it('throws on text that is not JSON', () => {
    expect(() => safeJsonParse('{not json')).toThrow(SyntaxError);
  });

  it('rejects values that JSON cannot hold at compile time', () => {
    // @ts-expect-error a function is not JSON-compatible
    safeJsonStringify<{ run: () => void }>({ run: () => undefined });
  });
});
