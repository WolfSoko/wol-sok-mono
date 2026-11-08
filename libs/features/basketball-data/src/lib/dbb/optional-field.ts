/**
 * `{ [key]: value }`, or `{}` where `value` is absent, to spread into a
 * domain object whose optional fields are left out rather than `undefined`.
 */
export function optionalField<K extends string, V>(
  key: K,
  value: V | undefined
): { readonly [P in K]?: V } {
  return (value === undefined ? {} : { [key]: value }) as {
    readonly [P in K]?: V;
  };
}
