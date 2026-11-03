import "@testing-library/jest-dom";

// Node 25+ defines its own `localStorage` global, which is undefined unless node runs with
// --localstorage-file. Vitest's jsdom environment does not copy window properties that already
// exist on the global, so `window.localStorage` stays undefined. Put jsdom's own Storage back.
const jsdomWindow = (globalThis as { jsdom?: { window: Window & typeof globalThis } }).jsdom?.window;
if (jsdomWindow) {
  for (const key of ["localStorage", "sessionStorage"] as const) {
    if (!(window[key] instanceof jsdomWindow.Storage)) {
      Object.defineProperty(window, key, {
        configurable: true,
        enumerable: true,
        value: jsdomWindow[key]
      });
    }
  }
}
