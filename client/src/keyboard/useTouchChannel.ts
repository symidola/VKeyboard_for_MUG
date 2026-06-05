import React from 'react';
import type { KeyboardKey } from '@vkeyboard/shared';
import { KEY_SELECTOR } from './constants';
import { getTouchMitigationConfig } from './touchFailureMitigations';

type ResolveKeyOptions = {
  preferTarget?: boolean;
  preferNearest?: boolean;
  nearestTolerancePx?: number;
};

type UseTouchChannelParams = {
  editMode: boolean;
  touchPrimary: boolean;
  debugTouch: boolean;
  dbg: (event: string, data?: any) => void;
  keyById: Map<string, KeyboardKey>;
  resolveKeyFromClientPoint: (
    xClient: number,
    yClient: number,
    target?: EventTarget | null,
    options?: ResolveKeyOptions,
  ) => KeyboardKey | null;
  pressKey: (pointerId: number, key: KeyboardKey) => void;
  releasePointer: (pointerId: number) => void;
};

// Touch 主通道：承接移动端触摸输入，提供滑移跟踪与宽限释放机制。
export function useTouchChannel(params: UseTouchChannelParams): void {
  const {
    editMode,
    touchPrimary,
    debugTouch,
    dbg,
    keyById,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
  } = params;

  React.useEffect(() => {
    if (editMode || !touchPrimary) return;

    type TouchSnapshot = {
      identifier: number;
      clientX: number;
      clientY: number;
      target: EventTarget | null;
    };

    let rafId = 0;
    let currentTouches: TouchSnapshot[] = [];
    let trackedTouchIds = new Set<number>();
    let touchPidById = new Map<number, number>();
    let nextTouchPid = 1000000;
    let unresolvedFrames = new Map<number, number>();
    let vanishedAt = new Map<number, number>();
    const mitigations = getTouchMitigationConfig();
    const releaseMissThreshold = mitigations.releaseMissThreshold;
    const touchNearestTolerancePx = mitigations.touchNearestTolerancePx;
    const vanishedGraceMs = mitigations.vanishedGraceMs;

    const toSnapshot = (touches: TouchList): TouchSnapshot[] => {
      return Array.from(touches).map((t) => ({
        identifier: t.identifier,
        clientX: t.clientX,
        clientY: t.clientY,
        target: (t as any).target ?? null,
      }));
    };

    const allocTouchPid = (touchId: number): number => {
      const pid = nextTouchPid++;
      touchPidById.set(touchId, pid);
      return pid;
    };

    const getTouchPid = (touchId: number): number => {
      return touchPidById.get(touchId) ?? allocTouchPid(touchId);
    };

    const reconcileTouches = (): boolean => {
      const now = performance.now();
      const nextTracked = new Set<number>();

      for (const t of currentTouches) {
        const key = resolveKeyFromClientPoint(t.clientX, t.clientY, t.target, {
          preferTarget: false,
          preferNearest: true,
          nearestTolerancePx: touchNearestTolerancePx,
        });
        const wasTracked = trackedTouchIds.has(t.identifier);
        const shouldTrack = wasTracked || !!key;
        if (!shouldTrack) continue;

        const pid = getTouchPid(t.identifier);
        if (key) {
          nextTracked.add(t.identifier);
          unresolvedFrames.delete(t.identifier);
          vanishedAt.delete(t.identifier);
          pressKey(pid, key);
        } else {
          if (!wasTracked) continue;
          const missCount = (unresolvedFrames.get(t.identifier) ?? 0) + 1;
          if (missCount >= releaseMissThreshold) {
            releasePointer(pid);
            unresolvedFrames.delete(t.identifier);
            touchPidById.delete(t.identifier);
            continue;
          }
          unresolvedFrames.set(t.identifier, missCount);
          nextTracked.add(t.identifier);
        }
      }

      for (const touchId of trackedTouchIds) {
        if (!nextTracked.has(touchId)) {
          const firstMissAt = vanishedAt.get(touchId);
          if (firstMissAt == null) {
            vanishedAt.set(touchId, now);
            nextTracked.add(touchId);
            continue;
          }

          if (now - firstMissAt < vanishedGraceMs) {
            nextTracked.add(touchId);
            continue;
          }

          unresolvedFrames.delete(touchId);
          vanishedAt.delete(touchId);
          const pid = touchPidById.get(touchId);
          if (pid != null) {
            releasePointer(pid);
            touchPidById.delete(touchId);
          }
        }
      }

      trackedTouchIds = nextTracked;
      return trackedTouchIds.size > 0;
    };

    const touchEventHitsKeyboard = (ev: TouchEvent): boolean => {
      for (const t of Array.from(ev.changedTouches)) {
        const target = (t as any).target as EventTarget | null;
        const el = target as HTMLElement | null;
        if (el?.closest?.(KEY_SELECTOR)) return true;
        const key = resolveKeyFromClientPoint(t.clientX, t.clientY, target, {
          preferTarget: true,
          preferNearest: true,
          nearestTolerancePx: touchNearestTolerancePx,
        });
        if (key) return true;
      }
      return false;
    };

    const onTouchEvent = (ev: TouchEvent) => {
      // 对明确结束/取消的触点做立即清理，避免“最后一个键抬起后短暂失灵”。
      if (ev.type === 'touchend' || ev.type === 'touchcancel') {
        for (const t of Array.from(ev.changedTouches)) {
          const touchId = t.identifier;
          const pid = touchPidById.get(touchId);
          if (pid != null) {
            releasePointer(pid);
            touchPidById.delete(touchId);
          }
          trackedTouchIds.delete(touchId);
          unresolvedFrames.delete(touchId);
          vanishedAt.delete(touchId);
        }
      }

      currentTouches = toSnapshot(ev.touches);
      let bootstrapPressed = false;
      const hitKeyboard = touchEventHitsKeyboard(ev);

      if (ev.type === 'touchstart') {
        for (const t of Array.from(ev.changedTouches)) {
          const touchId = t.identifier;
          const prevPid = touchPidById.get(touchId);
          if (prevPid != null) {
            releasePointer(prevPid);
          }
          const pid = allocTouchPid(touchId);

          const key = resolveKeyFromClientPoint(t.clientX, t.clientY, (t as any).target ?? ev.target, {
            preferTarget: true,
            preferNearest: true,
            nearestTolerancePx: touchNearestTolerancePx,
          });
          if (!key) continue;
          trackedTouchIds.add(touchId);
          unresolvedFrames.delete(touchId);
          vanishedAt.delete(touchId);
          pressKey(pid, key);
          bootstrapPressed = true;
        }
      }

      const hasActiveKeyboardTouch = reconcileTouches();

      if (
        ev.cancelable &&
        (ev.type === 'touchstart' || ev.type === 'touchmove') &&
        (hitKeyboard || bootstrapPressed || hasActiveKeyboardTouch)
      ) {
        ev.preventDefault();
      }
    };

    const tick = () => {
      reconcileTouches();
      rafId = window.requestAnimationFrame(tick);
    };

    window.addEventListener('touchstart', onTouchEvent, { capture: true, passive: false } as any);
    window.addEventListener('touchmove', onTouchEvent, { capture: true, passive: false } as any);
    window.addEventListener('touchend', onTouchEvent, { capture: true, passive: false } as any);
    window.addEventListener('touchcancel', onTouchEvent, { capture: true, passive: false } as any);
    rafId = window.requestAnimationFrame(tick);

    return () => {
      window.cancelAnimationFrame(rafId);
      window.removeEventListener('touchstart', onTouchEvent as any, true as any);
      window.removeEventListener('touchmove', onTouchEvent as any, true as any);
      window.removeEventListener('touchend', onTouchEvent as any, true as any);
      window.removeEventListener('touchcancel', onTouchEvent as any, true as any);
      for (const touchId of trackedTouchIds) {
        const pid = touchPidById.get(touchId);
        if (pid != null) releasePointer(pid);
      }
      unresolvedFrames.clear();
      vanishedAt.clear();
      touchPidById.clear();
    };
  }, [
    editMode,
    keyById,
    pressKey,
    releasePointer,
    resolveKeyFromClientPoint,
    dbg,
    debugTouch,
    touchPrimary,
  ]);
}
