import type { Presence } from '../presence';

/**
 * The Realtime Database in memory, for the specs: one value per path; a
 * read of a parent gathers its direct children.
 */
export class MemoryPresence implements Presence {
  public readonly values = new Map<string, unknown>();

  public async set(path: string, value: unknown): Promise<void> {
    this.values.set(path, value);
  }

  public async remove(path: string): Promise<void> {
    for (const key of this.values.keys()) {
      if (key === path || key.startsWith(`${path}/`)) {
        this.values.delete(key);
      }
    }
  }

  public async read(path: string): Promise<unknown> {
    if (this.values.has(path)) {
      return this.values.get(path);
    }
    const children = [...this.values.entries()].filter(
      ([key]) =>
        key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/')
    );
    return children.length === 0
      ? null
      : Object.fromEntries(
          children.map(([key, value]) => [key.slice(path.length + 1), value])
        );
  }
}
