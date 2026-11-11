export { isStorageFull } from './lib/is-storage-full';
export {
  deviceStorage,
  readStored,
  readStoredJson,
  writeStored,
  writeStoredJson,
} from './lib/stored';
export type { KeyValueStorage, StoreOutcome } from './lib/stored';
export { watchStored } from './lib/watch-stored';
export type { StorageEventTarget } from './lib/watch-stored';
