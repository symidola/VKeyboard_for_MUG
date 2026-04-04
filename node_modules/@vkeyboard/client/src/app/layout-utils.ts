import type { KeyboardKey, KeyboardLayout } from '@vkeyboard/shared';
import { djmax8bLayout } from '../layouts/djmax8b';

export type ThemeMode = 'dark' | 'light';

type LayoutStorage = {
  theme: ThemeMode;
  layout: KeyboardLayout;
};

const STORAGE_KEY = 'vkeyboard_state';

function safeGetStorage(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function safeSetStorage(value: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    // ignore write failures in private mode or restricted environments
  }
}

export function loadStorage(): LayoutStorage {
  const raw = safeGetStorage();
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LayoutStorage;
      if (parsed?.layout?.rows?.length) {
        return parsed;
      }
    } catch {
      // ignore invalid legacy data
    }
  }
  return { theme: 'dark', layout: djmax8bLayout };
}

export function saveStorage(state: LayoutStorage): void {
  safeSetStorage(JSON.stringify(state));
}

export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function clampInt(n: number, min: number, max: number): number {
  return Math.trunc(clamp(n, min, max));
}

export function updateKey(layout: KeyboardLayout, keyId: string, patch: Partial<KeyboardKey>): KeyboardLayout {
  return {
    ...layout,
    rows: layout.rows.map((r) => ({
      ...r,
      keys: r.keys.map((k) => (k.id === keyId ? { ...k, ...patch } : k)),
    })),
  };
}

export function updateLayout(layout: KeyboardLayout, patch: Partial<KeyboardLayout>): KeyboardLayout {
  return { ...layout, ...patch };
}

export function normalizeLayout(input: KeyboardLayout): KeyboardLayout {
  const unitPx = typeof input.unitPx === 'number' ? clampInt(input.unitPx, 28, 120) : undefined;
  const gapPx = typeof input.gapPx === 'number' ? clampInt(input.gapPx, 0, 40) : undefined;

  return {
    ...input,
    unitPx,
    gapPx,
    rows: input.rows.map((r) => ({
      ...r,
      keys: r.keys.map((k) => ({
        ...k,
        width: clamp(k.width, 0.5, 12),
        height: clamp(k.height, 0.5, 6),
        gapBefore: typeof k.gapBefore === 'number' ? clamp(k.gapBefore, 0, 20) : undefined,
        x: typeof k.x === 'number' ? clamp(k.x, -10, 50) : undefined,
        y: typeof k.y === 'number' ? clamp(k.y, -10, 50) : undefined,
      })),
    })),
  };
}