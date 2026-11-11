# utils-browser-storage

Small helpers for the browser's Web Storage (`localStorage`), shared by the
apps and libs that keep data on the device. One rule for all of them: a
storage that is missing (a server), blocked (private mode, site data off) or
holds unreadable JSON reads as nothing stored, and a write the storage
refuses keeps nothing and throws nothing.

- `deviceStorage()`: the window's `localStorage`, `undefined` without a
  window or where the browser withholds it.
- `readStored(key, storage)` / `writeStored(key, value, storage)`: text;
  `null` as the value removes the entry. A write returns its
  `StoreOutcome`: `'stored'`, `'full'` or `'refused'`.
- `readStoredJson(key, storage)` / `writeStoredJson(key, value, storage)`:
  JSON values, `null` where none or unreadable (through `parseJson` of
  `@wolsok/utils-json`). A value JSON cannot hold throws: that is a bug.
- `watchStored(key, onChange, target)`: calls `onChange` when another tab
  changes `key` or clears the storage; returns the function that stops it.
- `isStorageFull(error)`: whether a `setItem` failed because the storage is
  full (`QuotaExceededError`, Firefox's `NS_ERROR_DOM_QUOTA_REACHED`).

The storage is always a parameter (`KeyValueStorage | undefined`), so specs
pass a fake and a caller says where there is none.

Run the specs with `npx nx test utils-browser-storage`.
