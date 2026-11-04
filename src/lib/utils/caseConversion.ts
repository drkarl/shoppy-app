/**
 * Case conversion utilities for converting object keys between
 * camelCase (Dexie/TypeScript) and snake_case (Supabase/PostgreSQL)
 */

type Primitive = string | number | boolean | null | undefined;

type DeepSnakeCase<T> = T extends Primitive
  ? T
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? Array<DeepSnakeCase<U>>
      : T extends object
        ? { [K in keyof T as SnakeCase<K & string>]: DeepSnakeCase<T[K]> }
        : T;

type DeepCamelCase<T> = T extends Primitive
  ? T
  : T extends Date
    ? T
    : T extends Array<infer U>
      ? Array<DeepCamelCase<U>>
      : T extends object
        ? { [K in keyof T as CamelCase<K & string>]: DeepCamelCase<T[K]> }
        : T;

type SnakeCase<S extends string> = S extends `${infer T}${infer U}`
  ? U extends Uncapitalize<U>
    ? `${Lowercase<T>}${SnakeCase<U>}`
    : `${Lowercase<T>}_${SnakeCase<U>}`
  : S;

type CamelCase<S extends string> = S extends `${infer T}_${infer U}`
  ? `${T}${Capitalize<CamelCase<U>>}`
  : S;

/**
 * Convert a single string from camelCase to snake_case
 */
function stringToSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

/**
 * Convert a single string from snake_case to camelCase
 */
function stringToCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase());
}

/**
 * Convert all keys of an object (and nested objects/arrays) from camelCase to snake_case.
 * Use this when sending data to Supabase.
 *
 * @example
 * toSnakeCase({ displayName: "Milk", categoryId: "123" })
 * // Returns: { display_name: "Milk", category_id: "123" }
 */
export function toSnakeCase<T>(obj: T): DeepSnakeCase<T> {
  if (obj === null || obj === undefined) {
    return obj as DeepSnakeCase<T>;
  }

  if (obj instanceof Date) {
    return obj as DeepSnakeCase<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toSnakeCase(item)) as DeepSnakeCase<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const snakeKey = stringToSnakeCase(key);
      result[snakeKey] = toSnakeCase(value);
    }
    return result as DeepSnakeCase<T>;
  }

  return obj as DeepSnakeCase<T>;
}

/**
 * Convert all keys of an object (and nested objects/arrays) from snake_case to camelCase.
 * Use this when receiving data from Supabase to use with Dexie.
 *
 * @example
 * toCamelCase({ display_name: "Milk", category_id: "123" })
 * // Returns: { displayName: "Milk", categoryId: "123" }
 */
export function toCamelCase<T>(obj: T): DeepCamelCase<T> {
  if (obj === null || obj === undefined) {
    return obj as DeepCamelCase<T>;
  }

  if (obj instanceof Date) {
    return obj as DeepCamelCase<T>;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => toCamelCase(item)) as DeepCamelCase<T>;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      const camelKey = stringToCamelCase(key);
      result[camelKey] = toCamelCase(value);
    }
    return result as DeepCamelCase<T>;
  }

  return obj as DeepCamelCase<T>;
}
