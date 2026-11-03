/**
 * Minimal localStorage shim so the persisted Zustand store can hydrate in a
 * Node test environment. Values are stored in-memory per test worker.
 */
if (typeof globalThis.localStorage === "undefined") {
  const store = new Map<string, string>();

  const localStorageShim: Storage = {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (key: string) => (store.has(key) ? (store.get(key) as string) : null),
    key: (index: number) => Array.from(store.keys())[index] ?? null,
    removeItem: (key: string) => {
      store.delete(key);
    },
    setItem: (key: string, value: string) => {
      store.set(key, String(value));
    },
  };

  Object.defineProperty(globalThis, "localStorage", {
    value: localStorageShim,
    configurable: true,
  });
}

export {};
