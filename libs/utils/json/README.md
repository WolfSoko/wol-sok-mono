# utils-json

Types that keep a value JSON-serialisable at compile time (`JSONValue`, `JSONCompatible<T>`) and typed wrappers around `JSON.stringify`/`JSON.parse` (`safeJsonStringify`, `safeJsonParse`, which returns `unknown` for the caller to validate).

Run `npx nx test utils-json` for the unit tests (Jest).
