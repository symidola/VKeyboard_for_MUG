import React from 'react';
import type { KeyboardKey } from '@vkeyboard/shared';
import { KEY_SELECTOR } from './constants';

type BaseParams = {
  editMode: boolean;
  keyById: Map<string, KeyboardKey>;
  pressKey: (pointerId: number, key: KeyboardKey) => void;
  releasePointer: (pointerId: number) => void;
};

// ─────────────────────────────────────────────────────────────
// Strategy A: CSS :active polling
// On iOS, the :active pseudo-class is applied immediately when
// a finger touches a button — before touchstart or pointerdown
// fire. We poll :active every 8ms and synthesise press/release.
// ─────────────────────────────────────────────────────────────
export function useActivePolling(params: BaseParams & { enabled: boolean }): void {
  React.useEffect(() => {
    if (params.editMode || !params.enabled) return;

    const activeMap = new Map<string, number>();
    let nextPid = 9_000_000;
    const intervalMs = 8;

    const poll = () => {
      const els = document.querySelectorAll(`${KEY_SELECTOR}:active`);
      const seen = new Set<string>();

      for (const el of els) {
        const keyId = (el as HTMLElement).dataset?.keyid;
        if (!keyId) continue;
        seen.add(keyId);

        if (activeMap.has(keyId)) continue;
        const key = params.keyById.get(keyId);
        if (!key) continue;

        const pid = nextPid++;
        activeMap.set(keyId, pid);
        params.pressKey(pid, key);
      }

      for (const [keyId, pid] of activeMap) {
        if (!seen.has(keyId)) {
          params.releasePointer(pid);
          activeMap.delete(keyId);
        }
      }
    };

    const id = window.setInterval(poll, intervalMs);
    return () => {
      window.clearInterval(id);
      for (const [, pid] of activeMap) params.releasePointer(pid);
    };
  }, [params.editMode, params.enabled, params.keyById, params.pressKey, params.releasePointer]);
}

// ─────────────────────────────────────────────────────────────
// Strategy B: Direct native element capture
// Attaches native pointerdown/up listeners on every .key element
// in capture phase, bypassing React's synthetic event pipeline
// entirely. This eliminates any React-induced latency.
// ─────────────────────────────────────────────────────────────
export function useDirectCapture(params: BaseParams & { enabled: boolean }): void {
  React.useEffect(() => {
    if (params.editMode || !params.enabled) return;

    const pids = new Map<Element, number>();
    let nextPid = 8_000_000;

    const onDown = (ev: Event) => {
      const pe = ev as PointerEvent;
      const el = pe.currentTarget as HTMLElement;
      const keyId = el.dataset?.keyid;
      if (!keyId) return;
      const key = params.keyById.get(keyId);
      if (!key) return;

      pe.preventDefault();
      try { el.setPointerCapture?.(pe.pointerId); } catch { /* */ }

      const pid = nextPid++;
      pids.set(el, pid);
      params.pressKey(pid, key);
    };

    const onUp = (ev: Event) => {
      const pe = ev as PointerEvent;
      const el = pe.currentTarget as HTMLElement;
      const pid = pids.get(el);
      if (pid == null) return;
      pids.delete(el);
      params.releasePointer(pid);
    };

    const els = document.querySelectorAll(KEY_SELECTOR);
    for (const el of els) {
      el.addEventListener('pointerdown', onDown, { capture: true, passive: false });
      el.addEventListener('pointerup', onUp, { capture: true });
      el.addEventListener('pointercancel', onUp, { capture: true });
    }

    return () => {
      const all = document.querySelectorAll(KEY_SELECTOR);
      for (const el of all) {
        el.removeEventListener('pointerdown', onDown, true);
        el.removeEventListener('pointerup', onUp, true);
        el.removeEventListener('pointercancel', onUp, true);
      }
      for (const [, pid] of pids) params.releasePointer(pid);
    };
  }, [params.editMode, params.enabled, params.keyById, params.pressKey, params.releasePointer]);
}

// ─────────────────────────────────────────────────────────────
// Strategy C: Keyboard container pointer capture
// Uses setPointerCapture on the .kb wrapper so that all pointer
// events are routed there regardless of which child element
// they land on. Combined with a raw pointerdown handler.
// ─────────────────────────────────────────────────────────────
export function useContainerCapture(
  params: BaseParams & {
    enabled: boolean;
    containerRef: React.RefObject<HTMLElement | null>;
  },
): void {
  React.useEffect(() => {
    if (params.editMode || !params.enabled) return;

    const el = params.containerRef.current;
    if (!el) return;

    let nextPid = 7_000_000;
    const captured = new Map<number, number>();

    const onDown = (ev: PointerEvent) => {
      const hit = (ev.target as HTMLElement)?.closest?.(KEY_SELECTOR) as HTMLElement | null;
      const keyId = hit?.dataset?.keyid;
      if (!keyId) return;
      const key = params.keyById.get(keyId);
      if (!key) return;

      ev.preventDefault();
      try { el.setPointerCapture?.(ev.pointerId); } catch { /* */ }

      const pid = nextPid++;
      captured.set(ev.pointerId, pid);
      params.pressKey(pid, key);
    };

    const onUp = (ev: PointerEvent) => {
      const pid = captured.get(ev.pointerId);
      if (pid == null) return;
      captured.delete(ev.pointerId);
      params.releasePointer(pid);
    };

    el.addEventListener('pointerdown', onDown, { capture: true, passive: false });
    el.addEventListener('pointerup', onUp, { capture: true });
    el.addEventListener('pointercancel', onUp, { capture: true });

    return () => {
      el.removeEventListener('pointerdown', onDown, true);
      el.removeEventListener('pointerup', onUp, true);
      el.removeEventListener('pointercancel', onUp, true);
      for (const [, pid] of captured) params.releasePointer(pid);
    };
  }, [params.editMode, params.enabled, params.keyById, params.pressKey, params.releasePointer]);
}

// ─────────────────────────────────────────────────────────────
// Strategy D: RAF-backed polling
// Uses requestAnimationFrame (coupled to display refresh)
// instead of setInterval for more battery-friendly polling.
// Checks CSS :active and directly reads elementFromPoint.
// ─────────────────────────────────────────────────────────────
export function useRafPolling(params: BaseParams & { enabled: boolean }): void {
  React.useEffect(() => {
    if (params.editMode || !params.enabled) return;

    const activeMap = new Map<string, number>();
    let nextPid = 6_000_000;
    let rafId = 0;

    const poll = () => {
      const els = document.querySelectorAll(`${KEY_SELECTOR}:active`);
      const seen = new Set<string>();

      for (const el of els) {
        const keyId = (el as HTMLElement).dataset?.keyid;
        if (!keyId) continue;
        seen.add(keyId);

        if (activeMap.has(keyId)) continue;
        const key = params.keyById.get(keyId);
        if (!key) continue;

        const pid = nextPid++;
        activeMap.set(keyId, pid);
        params.pressKey(pid, key);
      }

      for (const [keyId, pid] of activeMap) {
        if (!seen.has(keyId)) {
          params.releasePointer(pid);
          activeMap.delete(keyId);
        }
      }

      rafId = window.requestAnimationFrame(poll);
    };

    rafId = window.requestAnimationFrame(poll);
    return () => {
      window.cancelAnimationFrame(rafId);
      for (const [, pid] of activeMap) params.releasePointer(pid);
    };
  }, [params.editMode, params.enabled, params.keyById, params.pressKey, params.releasePointer]);
}

// ─────────────────────────────────────────────────────────────
// Strategy E: Microtask-latched reconciliation
// After every touch event, schedules a microtask to re-run
// reconciliation, ensuring state updates are captured within
// the same event-loop tick rather than waiting for the next rAF.
// ─────────────────────────────────────────────────────────────
export function useMicrotaskRecon(reconcilerRef: React.MutableRefObject<(() => void) | null>): void {
  React.useEffect(() => {
    const origReconcile = reconcilerRef.current;
    if (!origReconcile) return;

    const onEvent = () => {
      queueMicrotask(() => origReconcile());
    };

    window.addEventListener('touchstart', onEvent, { capture: true, passive: true });
    window.addEventListener('touchmove', onEvent, { capture: true, passive: true });
    window.addEventListener('touchend', onEvent, { capture: true, passive: true });
    window.addEventListener('pointerdown', onEvent, { capture: true, passive: true });
    window.addEventListener('pointermove', onEvent, { capture: true, passive: true });
    window.addEventListener('pointerup', onEvent, { capture: true, passive: true });

    return () => {
      window.removeEventListener('touchstart', onEvent, true);
      window.removeEventListener('touchmove', onEvent, true);
      window.removeEventListener('touchend', onEvent, true);
      window.removeEventListener('pointerdown', onEvent, true);
      window.removeEventListener('pointermove', onEvent, true);
      window.removeEventListener('pointerup', onEvent, true);
    };
  }, []);
}

// ─────────────────────────────────────────────────────────────
// URL param parsing & labels
// ─────────────────────────────────────────────────────────────

export type IosFixMode =
  | 'off'
  | 'activePoll'
  | 'directCapture'
  | 'containerCapture'
  | 'rafPoll'
  | 'microtaskRecon'
  | 'all';

const VALID_MODES: IosFixMode[] = [
  'off',
  'activePoll',
  'directCapture',
  'containerCapture',
  'rafPoll',
  'microtaskRecon',
  'all',
];

export function readIosFixMode(): IosFixMode {
  try {
    const qs = new URLSearchParams(window.location.search);
    const v = qs.get('iosFix');
    if (v && (VALID_MODES as string[]).includes(v)) return v as IosFixMode;
  } catch { /* */ }
  return 'off';
}

export const IOS_FIX_LABELS: Record<IosFixMode, string> = {
  off: '关闭',
  activePoll: ':active 轮询',
  directCapture: '直接捕获',
  containerCapture: '容器捕获',
  rafPoll: 'RAF 轮询',
  microtaskRecon: '微任务协调',
  all: '全部启用',
};

export const IOS_FIX_DESCRIPTIONS: Record<IosFixMode, string> = {
  off: '仅使用已合并的默认修复 (touchPointerFallback + manipulation)',
  activePoll: '每 8ms 查询 .key:active CSS 伪类，绕过 iOS touchstart 延迟',
  directCapture: '在每个 key 元素上注册原生 pointerdown 捕获，完全绕过 React 事件系统',
  containerCapture: '在 .kb 容器上 setPointerCapture，确保所有 pointer 事件汇聚到一处',
  rafPoll: '每帧 (rAF) 轮询 :active 伪类，比 setInterval 更平滑且与显示器同步',
  microtaskRecon: '每次触控事件后在微任务中重新协调，消除 rAF 帧间隔延迟',
  all: '同时启用 :active 轮询 + 直接捕获 + RAF 轮询，不包含容器捕获（避免冲突）',
};

export const IOS_FIX_MODES: IosFixMode[] = ['off', 'activePoll', 'directCapture', 'containerCapture', 'rafPoll', 'all'];
