import { redactUrls } from './log-redaction';

describe('redactUrls', () => {
  it.each([
    ['http://localhost:4200/main.js?v=1#top', 'http://localhost:4200/main.js'],
    ['https://user:secret@example.test/api', 'https://example.test/api'],
    [
      'wss://relay.example.test/socket?token=abc',
      'wss://relay.example.test/socket',
    ],
    ['blob:http://localhost:4200/0f1e?x=1', 'blob:http://localhost:4200/0f1e'],
    ['http://localhost:4200/', 'http://localhost:4200/'],
    ['http://user:pw@[bad/x?token=1', 'http://[bad/x'],
    ['http://u:p@ss@a.test/x', 'http://a.test/x'],
    ['WSS://U:P@Relay.test/s?token=abc', 'WSS://Relay.test/s'],
  ])('reduces %s to %s', (url, expected) => {
    expect(redactUrls(url)).toBe(expected);
  });

  it('strips query and hash of every URL in a message, keeping the text', () => {
    expect(
      redactUrls(
        'Http failure response for http://a.test/x?id=5#h: 404 at https://b.test/y'
      )
    ).toBe('Http failure response for http://a.test/x 404 at https://b.test/y');
  });

  it('keeps the text right after a URL without query that ends at a quote or bracket', () => {
    expect(
      redactUrls(
        '{"url":"https://example.test/api","error":"timeout"} <http://a.test/b> loaded `http://a.test/x`, then failed'
      )
    ).toBe(
      '{"url":"https://example.test/api","error":"timeout"} <http://a.test/b> loaded `http://a.test/x`, then failed'
    );
  });

  // The accepted cost: what follows a query up to the next whitespace goes
  // with it, since it cannot be told apart from JSON inside the query.
  it('drops the rest of the word after a query inside JSON or brackets', () => {
    expect(
      redactUrls(
        '{"url":"https://example.test/api?token=secret","error":"timeout"} <http://a.test/b?c=1>'
      )
    ).toBe('{"url":"https://example.test/api <http://a.test/b');
  });

  it('drops JSON inside a raw query', () => {
    expect(
      redactUrls('GET http://a.test/x?data={"a":"b","token":"secret"} failed')
    ).toBe('GET http://a.test/x failed');
  });

  // A query may hold these characters unencoded: app code writes raw URLs
  // into messages, and even a URL the browser serialised keeps a backtick.
  it.each([
    ["'", "https://example.test/api?token=public'secret-value"],
    ['"', 'https://example.test/api?token=public"secret-value'],
    ['<', 'https://example.test/api?token=public<secret-value'],
    ['>', 'https://example.test/api?token=public>secret-value'],
    ['`', 'https://example.test/api?token=public`secret-value'],
    ['" in a hash', 'https://example.test/api#token="secret-value"'],
  ])('drops the whole query holding an unencoded %s', (_delimiter, url) => {
    expect(redactUrls(`failed: ${url} (timeout)`)).toBe(
      'failed: https://example.test/api (timeout)'
    );
  });

  it.each([
    ["https://a.test/it's/here?x=secret", "https://a.test/it's/here"],
    ["https://a.test/it'.x?token=secret", "https://a.test/it'.x"],
    ['https://a.test/a"\'b?token=secret', 'https://a.test/a"\'b'],
    ["https://a.test/a'),b?token=secret", "https://a.test/a'),b"],
  ])('drops the query after a quote inside a path: %s', (url, expected) => {
    expect(redactUrls(url)).toBe(expected);
  });

  it('keeps the opening quote of a quoted URL with a query, and the text after it', () => {
    expect(
      redactUrls(
        "Access to fetch at 'https://example.test/api?token=secret' from origin 'http://localhost:4200' has been blocked."
      )
    ).toBe(
      "Access to fetch at 'https://example.test/api from origin 'http://localhost:4200' has been blocked."
    );
  });

  it('finds a URL glued to the word before it', () => {
    expect(redactUrls('urlhttps://a.test/x?token=secret')).toBe(
      'urlhttps://a.test/x'
    );
  });

  // Angular's HttpErrorResponse names the request's own URL on status 0,
  // which is relative where the app requested a relative path.
  it.each([
    [
      'Http failure response for /api/x?token=secret: 0 Unknown Error',
      'Http failure response for /api/x 0 Unknown Error',
    ],
    ['see //cdn.test/x?token=secret now', 'see //cdn.test/x now'],
    ["at '/api/x#token=secret'", "at '/api/x"],
    ['redirect:/login?next=secret', 'redirect:/login'],
    ['GET;/api?token=secret', 'GET;/api'],
    ['&/api?token=secret', '&/api'],
    ['x|/api?token=secret', 'x|/api'],
    ['http:/a.test/x?token=secret', 'http:/a.test/x'],
  ])('strips query and hash of a relative URL: %s', (text, expected) => {
    expect(redactUrls(text)).toBe(expected);
  });

  it('leaves a path without query or hash alone', () => {
    expect(
      redactUrls(
        'read /home/ci/app.log and/or 1/2 at (/app/node_modules/@a/b.js:1:2)'
      )
    ).toBe(
      'read /home/ci/app.log and/or 1/2 at (/app/node_modules/@a/b.js:1:2)'
    );
  });

  // The cost of finding relative URLs: a regex literal reads as one.
  it('cuts a quoted regex literal at its ?', () => {
    expect(
      redactUrls('Invalid regular expression: /a?b/: Nothing to repeat')
    ).toBe('Invalid regular expression: /a Nothing to repeat');
  });

  it.each([
    ['"https:\\/\\/a.test\\/x?token=secret"', '"https:\\/\\/a.test\\/x'],
    ['http:\\\\a.test\\x?token=secret', 'http:\\\\a.test\\x'],
    ['http:\\\\u:pw@[bad\\x?y', 'http://[bad\\x'],
  ])(
    'strips query and credentials of a URL written with backslashes: %s',
    (text, expected) => {
      expect(redactUrls(text)).toBe(expected);
    }
  );

  it('takes no @ after a closing quote for a password', () => {
    expect(redactUrls('{"a":"//a.test","b":"c@d"}')).toBe(
      '{"a":"//a.test","b":"c@d"}'
    );
  });

  it('leaves text without URLs alone', () => {
    expect(redactUrls('ReferenceError: ngDevMode is not defined')).toBe(
      'ReferenceError: ngDevMode is not defined'
    );
  });

  it.each([
    [
      'quotes in a query',
      `http://a.test/x?${"'a".repeat(100_000)}`,
      'http://a.test/x',
    ],
    ['# after a host', `http://[bad/${'#'.repeat(100_000)}`, 'http://[bad/'],
    ['slashes', '/'.repeat(100_000), '/'.repeat(100_000)],
    [
      'credentials without @',
      `//${'a'.repeat(100_000)}`,
      `//${'a'.repeat(100_000)}`,
    ],
  ])('reduces a long run of %s in linear time', (_kind, text, expected) => {
    expect(redactUrls(text)).toBe(expected);
  });
});
