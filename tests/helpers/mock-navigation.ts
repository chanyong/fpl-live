import { useSyncExternalStore } from "react";

/**
 * Stand-in for next/navigation in component tests: an in-memory address bar. A test mocks the module with
 *   vi.mock("next/navigation", () => import("./helpers/mock-navigation"));
 * and reads/sets the address through `nav`.
 */
let path = "/league/1";
const listeners = new Set<() => void>();

export const nav = {
  get path() {
    return path;
  },
  set(next: string) {
    path = next;
    listeners.forEach((listener) => listener());
  },
  pushes: [] as string[]
};

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Segments below /league/ID, like Next's useSelectedLayoutSegments in the league layout. */
export function useSelectedLayoutSegments(): string[] {
  const current = useSyncExternalStore(subscribe, () => path, () => path);
  return current.split("/").filter(Boolean).slice(2);
}

export function useRouter() {
  return {
    push(href: string) {
      nav.pushes.push(href);
      nav.set(href);
    },
    replace(href: string) {
      nav.set(href);
    },
    back() {},
    forward() {},
    refresh() {},
    prefetch() {}
  };
}

export function usePathname() {
  return useSyncExternalStore(subscribe, () => path, () => path);
}
