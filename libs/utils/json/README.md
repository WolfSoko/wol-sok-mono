# utils-json

Types that keep a value JSON-serialisable at compile time (`JSONValue`, `JSONCompatible<T>`) `toJsonValue`, which hands such a value on as a `JSONValue`, and `parseJson`, which reads unreadable or no text as `null`; reading and writing stored JSON is `@wolsok/utils-browser-storage`'s.

Run `npx nx test utils-json` for the unit tests (Jest).
