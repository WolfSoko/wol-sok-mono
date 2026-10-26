import { isRealtimeKey, type Realtime } from '../admin/realtime';

/**
 * A Realtime Database in memory for the specs, a tree like the real one:
 * `get` of a path returns the subtree, a node left without children goes,
 * `update` writes several paths at once - all or none - and a path with a
 * key the real one refuses (`isRealtimeKey`) throws, as it does there.
 * `tree` is the whole database.
 */
export function fakeRealtime(
  initial: Record<string, unknown> = {}
): Realtime & { tree: Record<string, unknown> } {
  const tree: Record<string, unknown> = structuredClone(initial);
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
  return {
    tree,
    get: async (path) => structuredClone(read(path)),
    set: async (path, value) => write(path, value),
    remove: async (path) => write(path, null),
    removeIf: async (path, test) => {
      if (test(read(path))) {
        write(path, null);
      }
    },
    update: async (values) => {
      // Checked first: one bad path fails the whole update.
      Object.keys(values).forEach(parts);
      for (const [path, value] of Object.entries(values)) {
        write(path, value);
      }
    },
  };
}
