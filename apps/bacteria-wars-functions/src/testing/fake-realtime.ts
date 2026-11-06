import { isRealtimeKey, type Realtime } from '../admin/realtime';

/** Calls that let a spec run another command in between, for races. */
export interface FakeRealtimeHooks {
  /** Before a read. */
  beforeGet?: () => Promise<unknown>;
  /** When a conditional remove starts, before it reads. */
  beforeRemoveIf?: () => Promise<unknown>;
  /** Once a conditional remove is done. */
  afterRemoveIf?: () => Promise<unknown>;
}

export interface FakeRealtimeOptions {
  /** Paths whose removal fails with `unavailable`; setting them works. */
  failRemoving?: readonly string[];
  hooks?: FakeRealtimeHooks;
}

export type FakeRealtime = Realtime & {
  /** The whole database. */
  tree: Record<string, unknown>;
  /**
   * What was written, in order: `set <path> <value>` and `remove <path>`,
   * whichever method wrote it. A `removeIf` whose test failed writes
   * nothing.
   */
  calls: string[];
};

/**
 * A Realtime Database in memory for the specs, a tree like the real one:
 * `get` of a path returns the subtree, a node left without children goes,
 * `update` writes several paths at once - all or none - and a path with a
 * key the real one refuses (`isRealtimeKey`) throws, as it does there.
 */
export function fakeRealtime(
  initial: Record<string, unknown> = {},
  { failRemoving = [], hooks = {} }: FakeRealtimeOptions = {}
): FakeRealtime {
  const tree: Record<string, unknown> = structuredClone(initial);
  const calls: string[] = [];
  const checkRemovable = (path: string) => {
    if (failRemoving.includes(path)) {
      throw new Error('unavailable');
    }
  };
  const parts = (path: string) => {
    const keys = path.split('/').filter((p) => p !== '');
    const bad = keys.find((key) => !isRealtimeKey(key));
    if (bad !== undefined) {
      throw new Error(`Invalid key in ${path}: ${bad}`);
    }
    return keys;
  };
  const read = (path: string): unknown => {
    let node: unknown = tree;
    for (const key of parts(path)) {
      if (typeof node !== 'object' || node === null) {
        return null;
      }
      node = (node as Record<string, unknown>)[key];
    }
    return node ?? null;
  };
  const write = (path: string, value: unknown): void => {
    const keys = parts(path);
    const last = keys.pop();
    if (last === undefined) {
      return;
    }
    const trail: [Record<string, unknown>, string][] = [];
    let node = tree;
    for (const key of keys) {
      const next = node[key];
      if (typeof next !== 'object' || next === null) {
        if (value === null) {
          return;
        }
        node[key] = {};
      }
      trail.push([node, key]);
      node = node[key] as Record<string, unknown>;
    }
    if (value === null) {
      delete node[last];
      // Like the real one, a node without children is no node.
      for (const [parent, key] of trail.reverse()) {
        if (Object.keys(parent[key] as object).length > 0) {
          break;
        }
        delete parent[key];
      }
    } else {
      node[last] = value;
    }
  };
  /** Writes and logs: `null` removes. */
  const record = (path: string, value: unknown): void => {
    if (value === null) {
      checkRemovable(path);
      write(path, null);
      calls.push(`remove ${path}`);
    } else {
      write(path, value);
      calls.push(`set ${path} ${JSON.stringify(value)}`);
    }
  };
  return {
    tree,
    calls,
    get: async (path) => {
      await hooks.beforeGet?.();
      return structuredClone(read(path));
    },
    set: async (path, value) => record(path, value),
    remove: async (path) => record(path, null),
    removeIf: async (path, test) => {
      await hooks.beforeRemoveIf?.();
      checkRemovable(path);
      if (test(read(path))) {
        record(path, null);
      }
      await hooks.afterRemoveIf?.();
    },
    update: async (values) => {
      // Checked first: one bad path fails the whole update.
      for (const [path, value] of Object.entries(values)) {
        parts(path);
        if (value === null) {
          checkRemovable(path);
        }
      }
      for (const [path, value] of Object.entries(values)) {
        record(path, value);
      }
    },
  };
}
