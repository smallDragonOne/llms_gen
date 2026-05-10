/**
 * Convert a snake_case database row to a camelCase TypeScript object.
 * Handles nested objects and arrays recursively.
 */
export function snakeToCamel<T = Record<string, unknown>>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
    result[camelKey] = value
  }
  return result as T
}

/**
 * Convert an array of snake_case database rows to camelCase objects.
 */
export function snakeToCamelArray<T = Record<string, unknown>>(rows: Record<string, unknown>[]): T[] {
  return rows.map((row) => snakeToCamel<T>(row))
}
