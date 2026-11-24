import { redactUrls, urlForLog } from './log-redaction';

describe('urlForLog', () => {
  it.each([
    ['http://localhost:4200/main.js?v=1#top', 'http://localhost:4200/main.js'],
    ['https://user:secret@example.test/api', 'https://example.test/api'],
    [
      'wss://relay.example.test/socket?token=abc',
      'wss://relay.example.test/socket',
    ],
    ['blob:http://localhost:4200/0f1e?x=1', 'blob:http://localhost:4200/0f1e'],
    ['http://localhost:4200/', 'http://localhost:4200/'],
  ])('reduces %s to %s', (url, expected) => {
    expect(urlForLog(url)).toBe(expected);
  });

  it('cuts query, hash and credentials off a URL it cannot parse', () => {
    expect(urlForLog('http://user:pw@[bad/x?token=1')).toBe('http://[bad/x');
  });

  // CodeQL flagged a /[?#].*$/ fallback as slow on a long run of '#'.
  it('cuts an unparsable URL with a long run of # in linear time', () => {
    const url = `http://[bad/${'#'.repeat(100_000)}`;

    expect(urlForLog(url)).toBe('http://[bad/');
  });
});

describe('redactUrls', () => {
  it('strips query and hash of every URL in a message, keeping the text', () => {
    expect(
      redactUrls(
        'Http failure response for http://a.test/x?id=5#h: 404 at https://b.test/y'
      )
    ).toBe('Http failure response for http://a.test/x 404 at https://b.test/y');
  });

  it('strips web socket URLs and credentials as well', () => {
    expect(
      redactUrls(
        'WebSocket connection to WSS://relay.test/s?token=abc failed, see http://u:p@c.test/d'
      )
    ).toBe(
      'WebSocket connection to wss://relay.test/s failed, see http://c.test/d'
    );
  });

  it('keeps the text right after a URL without query that ends at a quote or bracket', () => {
    expect(
      redactUrls(
        '{"url":"https://example.test/api","error":"timeout"} <http://a.test/b>'
      )
    ).toBe(
      '{"url":"https://example.test/api","error":"timeout"} <http://a.test/b>'
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
  ])('drops the whole query holding an unencoded %s', (_delimiter, url) => {
    expect(redactUrls(`failed: ${url} (timeout)`)).toBe(
      'failed: https://example.test/api (timeout)'
    );
  });

  it('drops a hash holding an unencoded quote', () => {
    expect(redactUrls('at http://a.test/x#t="secret" now')).toBe(
      'at http://a.test/x now'
    );
  });

  it('keeps the opening quote of a quoted URL with a query, and the text after it', () => {
    expect(
      redactUrls(
        "Access to fetch at 'https://example.test/api?token=secret' from origin 'http://localhost:4200' has been blocked."
      )
    ).toBe(
      "Access to fetch at 'https://example.test/api from origin 'http://localhost:4200/' has been blocked."
    );
  });

  it('keeps an apostrophe inside a path', () => {
    expect(redactUrls("see http://a.test/it's/here?x=1 now")).toBe(
      "see http://a.test/it's/here now"
    );
  });

  it('keeps a backtick-quoted URL without query apart from the text after it', () => {
    expect(redactUrls('loaded `http://a.test/x`, then failed')).toBe(
      'loaded `http://a.test/x`, then failed'
    );
  });

  it('finds a URL glued to the word before it', () => {
    expect(redactUrls('urlhttps://a.test/x?token=secret')).toBe(
      'urlhttps://a.test/x'
    );
  });

  it('reduces a long run of quotes in linear time', () => {
    const text = `http://a.test/x?${"'a".repeat(100_000)}`;

    expect(redactUrls(text)).toBe('http://a.test/x');
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
  ])('strips query and hash of a relative URL: %s', (text, expected) => {
    expect(redactUrls(text)).toBe(expected);
  });

  it('leaves a path without query or hash alone', () => {
    expect(redactUrls('read /home/ci/app.log and/or 1/2')).toBe(
      'read /home/ci/app.log and/or 1/2'
    );
  });

  it.each([
    ['"https:\\/\\/a.test\\/x?token=secret"'],
    ['http:\\\\a.test\\x?token=secret'],
  ])('strips the query of a URL written with backslashes: %s', (text) => {
    expect(redactUrls(text)).not.toContain('secret');
  });

  it('leaves text without URLs alone', () => {
    expect(redactUrls('ReferenceError: ngDevMode is not defined')).toBe(
      'ReferenceError: ngDevMode is not defined'
    );
  });
});
