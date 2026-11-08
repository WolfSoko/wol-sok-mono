import { BasketballDataError } from '../domain/basketball-data-error';

type Fields = Readonly<Record<string, unknown>>;

const MAX_SHOWN_VALUE_LENGTH = 60;

/**
 * One JSON object of a DBB response, read field by field. Each reader checks
 * the field's type and throws an `unexpected-shape` error naming its path,
 * so a change in the DBB's JSON fails loudly where it happens. `null` and a
 * missing field count the same: the DBB uses both for "none".
 */
export class DbbObject {
  private constructor(
    private readonly fields: Fields,
    public readonly path: string
  ) {}

  public static of(value: unknown, path: string): DbbObject {
    if (!isFields(value)) {
      throw shapeError(path, 'an object', value);
    }
    return new DbbObject(value, path);
  }

  /** A field of any type that must be present, for the caller to read. */
  public value(key: string): unknown {
    const value = this.fields[key];
    if (isAbsent(value)) {
      throw shapeError(this.pathOf(key), 'a value', value);
    }
    return value;
  }

  public number(key: string): number {
    return this.required(key, this.optionalNumber(key), 'a number');
  }

  public optionalNumber(key: string): number | undefined {
    return this.optional(key, 'a number', isNumber);
  }

  public string(key: string): string {
    return this.required(key, this.optionalString(key), 'a string');
  }

  public optionalString(key: string): string | undefined {
    return this.optional(key, 'a string', isString);
  }

  public boolean(key: string): boolean {
    return this.required(
      key,
      this.optional(key, 'a boolean', isBoolean),
      'a boolean'
    );
  }

  /** A flag the DBB sometimes leaves out, read as `false` then. */
  public optionalBoolean(key: string): boolean {
    return this.optional(key, 'a boolean', isBoolean) ?? false;
  }

  public object(key: string): DbbObject {
    return this.required(key, this.optionalObject(key), 'an object');
  }

  public optionalObject(key: string): DbbObject | undefined {
    const value = this.fields[key];
    return isAbsent(value) ? undefined : DbbObject.of(value, this.pathOf(key));
  }

  public objects(key: string): readonly DbbObject[] {
    return this.required(key, this.listOf(key), 'a list');
  }

  /** A list the DBB sometimes sends as `null`, read as empty then. */
  public optionalObjects(key: string): readonly DbbObject[] {
    return this.listOf(key) ?? [];
  }

  private listOf(key: string): readonly DbbObject[] | undefined {
    const value = this.fields[key];
    if (isAbsent(value)) {
      return undefined;
    }
    const path = this.pathOf(key);
    if (!Array.isArray(value)) {
      throw shapeError(path, 'a list', value);
    }
    return value.map((item: unknown, index) =>
      DbbObject.of(item, `${path}[${index}]`)
    );
  }

  private optional<T>(
    key: string,
    expected: string,
    isType: (value: unknown) => value is T
  ): T | undefined {
    const value = this.fields[key];
    if (isAbsent(value)) {
      return undefined;
    }
    if (!isType(value)) {
      throw shapeError(this.pathOf(key), expected, value);
    }
    return value;
  }

  private required<T>(key: string, value: T | undefined, expected: string): T {
    if (value === undefined) {
      throw shapeError(this.pathOf(key), expected, this.fields[key]);
    }
    return value;
  }

  private pathOf(key: string): string {
    return `${this.path}.${key}`;
  }
}

/** The error for a DBB value that is not what the lib reads. */
export function shapeError(
  path: string,
  expected: string,
  value: unknown
): BasketballDataError {
  return new BasketballDataError(
    'unexpected-shape',
    `${path}: expected ${expected}, got ${shown(value)}`
  );
}

function shown(value: unknown): string {
  const text = value === undefined ? 'nothing' : JSON.stringify(value);
  return text.length > MAX_SHOWN_VALUE_LENGTH
    ? `${text.slice(0, MAX_SHOWN_VALUE_LENGTH)}…`
    : text;
}

function isFields(value: unknown): value is Fields {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isAbsent(value: unknown): value is null | undefined {
  return value === null || value === undefined;
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isString(value: unknown): value is string {
  return typeof value === 'string';
}

function isBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}
