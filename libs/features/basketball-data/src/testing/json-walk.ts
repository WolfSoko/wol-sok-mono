import { isJsonObject, type JsonObject } from '../lib/dbb/dbb-object';

/** One string field of a JSON value, with the key it is under. */
export interface StringField {
  readonly key: string;
  readonly text: string;
}

/** Visits every object in `value`, however deeply nested in objects and lists. */
export function walkJson(
  value: unknown,
  visit: (object: JsonObject) => void
): void {
  if (Array.isArray(value)) {
    value.forEach((item: unknown) => walkJson(item, visit));
  } else if (isJsonObject(value)) {
    visit(value);
    Object.values(value).forEach((field) => walkJson(field, visit));
  }
}

/** Every object in `value`, in the order `walkJson` visits them. */
export function objectsIn(value: unknown): readonly JsonObject[] {
  const objects: JsonObject[] = [];
  walkJson(value, (object) => objects.push(object));
  return objects;
}

/** Every string field of every object in `value`. */
export function stringFieldsIn(value: unknown): readonly StringField[] {
  return objectsIn(value).flatMap((object) =>
    Object.entries(object).flatMap(([key, field]) =>
      typeof field === 'string' ? [{ key, text: field }] : []
    )
  );
}
