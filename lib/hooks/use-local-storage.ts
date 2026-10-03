"use client";

import { useCallback, useSyncExternalStore } from "react";

const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  window.addEventListener("storage", listener);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", listener);
  };
}

function read(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

/** localStorage value that is null during SSR and stays in sync across components/tabs. */
export function useLocalStorage(key: string) {
  const value = useSyncExternalStore(subscribe, () => read(key), () => null);
  const setValue = useCallback(
    (next: string | null) => {
      try {
        if (next === null) localStorage.removeItem(key);
        else localStorage.setItem(key, next);
      } catch {
        // storage unavailable (private mode etc.)
      }
      listeners.forEach((listener) => listener());
    },
    [key],
  );
  return [value, setValue] as const;
}

export function readLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
