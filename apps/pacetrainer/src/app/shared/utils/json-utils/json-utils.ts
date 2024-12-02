export type JSONPrimitive = string | number | boolean | null | undefined;

export type JSONValue =
  | JSONPrimitive
  | JSONValue[]
  | {
      [key: string]: JSONValue;
    };

export type NotAssignableToJson = bigint | symbol | typeof Function;

export type JSONCompatible<T> = unknown extends T
  ? never
  : {
      [P in keyof T]: T[P] extends JSONValue
        ? T[P]
        : T[P] extends NotAssignableToJson
          ? never
          : JSONCompatible<T[P]>;
    };

export function toJsonValue<T>(value: JSONCompatible<T>): JSONValue {
  return value;
}

export function safeJsonStringify<T>(data: JSONCompatible<T>) {
  return JSON.stringify(data);
}

export function safeJsonParse(text: string): unknown {
  return JSON.parse(text);
}
