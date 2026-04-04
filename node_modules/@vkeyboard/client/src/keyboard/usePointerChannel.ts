import React from 'react';
import type { KeyboardKey } from '@vkeyboard/shared';
import { KEY_SELECTOR } from './constants';
import { describeTarget } from './helpers';

type ResolveKeyOptions = {
  preferTarget?: boolean;
  preferNearest?: boolean;
  nearestTolerancePx?: number;
};

type UsePointerChannelParams = {
  editMode: boolean;
  touchPointerFallback: boolean;
  debugTouch: boolean;
  debugTouchMove: boolean;
  dbg: (event: string, data?: any) => void;
  lastTouchActiveAtRef: React.MutableRefObject<number>;
  fallbackTouchPointerPidsRef: React.MutableRefObject<Set<number>>;
  kbAbsRef: React.MutableRefObject<HTMLDivElement | null>;
  resolveKeyFromClientPoint: (
    xClient: number,
    yClient: number,
    target?: EventTarget | null,
    options?: ResolveKeyOptions,
  ) => KeyboardKey | null;
  pressKey: (pointerId: number, key: KeyboardKey) => void;
  releasePointer: (pointerId: number) => void;
  releaseAll: (reason: string) => void;
  releaseFallbackTouchPointers: () => void;
};

// Pointer 主通道：承接鼠标/触控笔输入，并在必要时为 touch 提供 fallback。
export function usePointerChannel(params: UsePointerChannelParams): void {
  const {
    editMode,
    touchPointerFallback,
    debugTouch,
    debugTouchMove,
    dbg,
    lastTouchActiveAtRef,
    fallbackTouchPointerPidsRef,
    kbAbsRef,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
    releaseAll,
    releaseFallbackTouchPointers,
  } = params;

  React.useEffect(() => {
    if (editMode) return;

    const pendingTouchFallbackTimers = new Map<number, number>();

    const clearPendingTouchFallback = (pointerId: number) => {
      const timerId = pendingTouchFallbackTimers.get(pointerId);
      if (timerId == null) return;
      window.clearTimeout(timerId);
      pendingTouchFallbackTimers.delete(pointerId);
    };

    const clearAllPendingTouchFallback = () => {
      for (const timerId of pendingTouchFallbackTimers.values()) {
        window.clearTimeout(timerId);
      }
      pendingTouchFallbackTimers.clear();
    };

    const onUp = (ev: PointerEvent) => {
      if ((ev as any).pointerType === 'touch') {
        clearPendingTouchFallback(ev.pointerId);
        if (!touchPointerFallback) return;
        const pid = 3000000 + ev.pointerId;
        if (fallbackTouchPointerPidsRef.current.has(pid)) {
          fallbackTouchPointerPidsRef.current.delete(pid);
          releasePointer(pid);
        }
        return;
      }
      releasePointer(ev.pointerId);
    };

    const onBlur = () => {
      clearAllPendingTouchFallback();
      releaseAll('blur');
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        clearAllPendingTouchFallback();
        releaseAll('hidden');
      }
    };

    const onGlobalDownCapture = (ev: PointerEvent) => {
      if ((ev as any).pointerType === 'touch') {
        if (!touchPointerFallback) return;

        const pointerId = ev.pointerId;
        const xClient = ev.clientX;
        const yClient = ev.clientY;
        const target = ev.target;
        const downAt = performance.now();

        clearPendingTouchFallback(pointerId);
        const timerId = window.setTimeout(() => {
          pendingTouchFallbackTimers.delete(pointerId);

          // 若 touchstart 已经到达，优先让 touch 主通道处理，避免双通道对消。
          if (lastTouchActiveAtRef.current > downAt) {
            if (debugTouch) {
              dbg('touch:pointer-fallback-skip-touch-active', { pointerId });
            }
            return;
          }

          const resolved = resolveKeyFromClientPoint(xClient, yClient, target, {
            preferTarget: true,
            preferNearest: true,
            nearestTolerancePx: 48,
          });
          if (!resolved) return;

          const pid = 3000000 + pointerId;
          fallbackTouchPointerPidsRef.current.add(pid);
          if (debugTouch) {
            dbg('touch:pointer-fallback-down', {
              pointerId,
              pid,
              keyId: resolved.id,
              label: resolved.label,
            });
          }
          pressKey(pid, resolved);
        }, 28);
        pendingTouchFallbackTimers.set(pointerId, timerId);
        return;
      }

      const el = kbAbsRef.current;
      if (!el) return;

      const target = ev.target as HTMLElement | null;
      if (target && (target as any).closest?.(KEY_SELECTOR)) return;

      const resolved = resolveKeyFromClientPoint(ev.clientX, ev.clientY, ev.target);
      if (!resolved) return;

      try {
        el.setPointerCapture?.(ev.pointerId);
      } catch {
        // ignore
      }

      if (debugTouch) {
        dbg('abs:win-press', {
          pointerId: ev.pointerId,
          keyId: resolved.id,
          label: resolved.label,
          target: describeTarget(ev.target),
        });
      }

      pressKey(ev.pointerId, resolved);
    };

    const onDbgEvent = (ev: PointerEvent) => {
      if (!debugTouch) return;
      if (ev.type === 'pointermove' && !debugTouchMove) return;
      const data: any = {
        type: ev.type,
        pointerId: ev.pointerId,
        pointerType: (ev as any).pointerType,
        buttons: (ev as any).buttons,
        x: Math.round(ev.clientX),
        y: Math.round(ev.clientY),
        target: describeTarget(ev.target),
      };
      dbg(`window:${ev.type}`, data);
    };

    window.addEventListener('pointerdown', onGlobalDownCapture, { capture: true } as any);
    window.addEventListener('pointerdown', onDbgEvent, { passive: true } as any);
    window.addEventListener('pointermove', onDbgEvent, { passive: true } as any);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('blur', onBlur);
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('pointerup', onDbgEvent, { passive: true } as any);
    window.addEventListener('pointercancel', onDbgEvent, { passive: true } as any);

    return () => {
      clearAllPendingTouchFallback();
      releaseFallbackTouchPointers();
      window.removeEventListener('pointerdown', onGlobalDownCapture as any, true as any);
      window.removeEventListener('pointerdown', onDbgEvent as any);
      window.removeEventListener('pointermove', onDbgEvent as any);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('pointerup', onDbgEvent as any);
      window.removeEventListener('pointercancel', onDbgEvent as any);
    };
  }, [
    dbg,
    debugTouch,
    debugTouchMove,
    editMode,
    fallbackTouchPointerPidsRef,
    kbAbsRef,
    lastTouchActiveAtRef,
    pressKey,
    releaseAll,
    releaseFallbackTouchPointers,
    releasePointer,
    resolveKeyFromClientPoint,
    touchPointerFallback,
  ]);
}
