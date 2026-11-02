/** Resolves with a copy of `value` after a short, network-like pause. */
export function respond<T>(value: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(copy(value)), ms));
}

/** Callers must not be able to mutate the mock "database" through a returned object. */
function copy<T>(value: T): T {
  return value === undefined ? value : (JSON.parse(JSON.stringify(value)) as T);
}
