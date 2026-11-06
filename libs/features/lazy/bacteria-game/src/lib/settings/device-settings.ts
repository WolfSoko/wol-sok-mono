import { signal, type WritableSignal } from '@angular/core';
import type { SettingSpec } from './setting-table';

type Table = Record<string, SettingSpec<unknown>>;
type ValuesOf<T extends Table> = { [K in keyof T]: T[K]['default'] };
type StoredOf<T extends Table> = {
  [K in keyof T]?: Exclude<ValuesOf<T>[K], null>;
};

/**
 * The device settings of a table, one signal per key: what each one is
 * now, what the player changed, and their stored form. Storage, the
 * statistics and what a setting sets off are its owner's business.
 */
export class DeviceSettings<T extends Table> {
  private readonly values: { [K in keyof T]: WritableSignal<ValuesOf<T>[K]> };
  /** The settings the player changed - what restoring must keep. */
  private readonly touched = new Set<keyof T>();

  public constructor(private readonly table: T) {
    this.values = Object.fromEntries(
      Object.entries(table).map(([key, spec]) => [key, signal(spec.default)])
    ) as { [K in keyof T]: WritableSignal<ValuesOf<T>[K]> };
  }

  /** The setting's value, read like a signal. */
  public value<K extends keyof T>(key: K): ValuesOf<T>[K] {
    return this.values[key]();
  }

  /** The player's choice: kept over what restoring finds. */
  public set<K extends keyof T>(key: K, value: ValuesOf<T>[K]): void {
    this.preview(key, value);
    this.touched.add(key);
  }

  /**
   * A value in force at once but not chosen yet - a slider still being
   * dragged: restoring may still replace it.
   */
  public preview<K extends keyof T>(key: K, value: ValuesOf<T>[K]): void {
    const spec = this.table[key];
    this.values[key].set(
      spec.normalize ? (spec.normalize(value) as ValuesOf<T>[K]) : value
    );
  }

  /**
   * Applies what an earlier visit stored: each setting it can read and the
   * player did not change meanwhile.
   */
  public restore(stored: Readonly<Record<string, unknown>>): void {
    for (const key of this.keys()) {
      if (this.touched.has(key)) continue;
      const value = this.table[key].parse(stored[key as string]);
      if (value !== undefined) {
        (this.values[key] as WritableSignal<unknown>).set(value);
      }
    }
  }

  /** The settings as they are stored, `null` ones left out. */
  public toStore(): StoredOf<T> {
    return Object.fromEntries(
      this.keys().map((key) => [key, this.values[key]() ?? undefined])
    ) as StoredOf<T>;
  }

  private keys(): (keyof T)[] {
    return Object.keys(this.table) as (keyof T)[];
  }
}
