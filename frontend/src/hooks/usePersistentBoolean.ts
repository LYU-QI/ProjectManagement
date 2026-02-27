import { useEffect, useState } from 'react';

function readInitialValue(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const value = window.localStorage.getItem(key);
    if (value === null) return fallback;
    return value === '1';
  } catch {
    return fallback;
  }
}

export default function usePersistentBoolean(key: string, fallback: boolean): [boolean, (next: boolean | ((prev: boolean) => boolean)) => void] {
  const [value, setValue] = useState<boolean>(() => readInitialValue(key, fallback));

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(key, value ? '1' : '0');
    } catch {
      // ignore storage failures in private mode or restricted environments.
    }
  }, [key, value]);

  return [value, setValue];
}
