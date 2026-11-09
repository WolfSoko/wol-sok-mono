# utils-browser-storage

Small helpers for the browser's Web Storage (`localStorage`), shared by the
apps and libs that keep data on the device.

- `isStorageFull(error)`: whether a `setItem` failed because the storage is
  full (`QuotaExceededError`, Firefox's `NS_ERROR_DOM_QUOTA_REACHED`).

Run the specs with `npx nx test utils-browser-storage`.
