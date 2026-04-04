import React from 'react';
import type { KeyboardKey } from '@vkeyboard/shared';
import { ANCHOR_O_KEY, KEY_SELECTOR } from './constants';

type ResolveKeyOptions = {
  preferTarget?: boolean;
  preferNearest?: boolean;
  nearestTolerancePx?: number;
};

type UseTouchChannelParams = {
  editMode: boolean;
  touchPrimary: boolean;
  simulateAlwaysTouch: boolean;
  strictTouchLock: boolean;
  touchGapBridgeMs: number;
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
  releaseFallbackTouchPointers: () => void;
  lastTouchActiveAtRef: React.MutableRefObject<number>;
  fallbackTouchPointerPidsRef: React.MutableRefObject<Set<number>>;
  kbRootRef: React.MutableRefObject<HTMLDivElement | null>;
};

// Touch 主通道：承接移动端触摸输入，提供滑移跟踪与宽限释放机制。
export function useTouchChannel(params: UseTouchChannelParams): void {
  const {
    editMode,
    touchPrimary,
    simulateAlwaysTouch,
    strictTouchLock,
    touchGapBridgeMs,
    debugTouch,
    dbg,
    keyById,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
    releaseFallbackTouchPointers,
    lastTouchActiveAtRef,
    fallbackTouchPointerPidsRef,
    kbRootRef,
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
    let lockedKeyByTouchId = new Map<number, string>();
    let nextTouchPid = 1000000;
    const anchorTouchId = -2147483000;
    let unresolvedFrames = new Map<number, number>();
    let vanishedAt = new Map<number, number>();
    const releaseMissThreshold = 3;
    const touchNearestTolerancePx = 42;
    const vanishedGraceMs = 22;
    const touchSessionGraceMs = 96;
    let touchSessionLockUntil = 0;
    let lastZeroTouchAt = -1;
    let bridgeForceLockUntil = 0;

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

    const getAnchorSnapshot = (): TouchSnapshot => {
      const anchorEl = kbRootRef.current?.querySelector?.(KEY_SELECTOR + '[data-keyid="__anchor_o__"]') as HTMLElement | null;
      if (anchorEl) {
        const rect = anchorEl.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            identifier: anchorTouchId,
            clientX: Math.round((rect.left + rect.right) * 0.5),
            clientY: Math.round((rect.top + rect.bottom) * 0.5),
            target: anchorEl,
          };
        }
      }

      const el = kbRootRef.current;
      if (el) {
        const rect = el.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          return {
            identifier: anchorTouchId,
            clientX: Math.round(rect.left + 4),
            clientY: Math.max(Math.round(rect.top + 1), Math.round(rect.bottom - 2)),
            target: el,
          };
        }
      }

      return {
        identifier: anchorTouchId,
        clientX: 4,
        clientY: Math.max(1, window.innerHeight - 2),
        target: null,
      };
    };

    if (simulateAlwaysTouch) {
      trackedTouchIds.add(anchorTouchId);
    }

    const reconcileTouches = (): boolean => {
      const now = performance.now();
      const nextTracked = new Set<number>();

      const touchesToProcess = simulateAlwaysTouch
        ? currentTouches.concat([getAnchorSnapshot()])
        : currentTouches;

      for (const t of touchesToProcess) {
        const isAnchorTouch = simulateAlwaysTouch && t.identifier === anchorTouchId;
        if (isAnchorTouch) {
          nextTracked.add(anchorTouchId);
          unresolvedFrames.delete(anchorTouchId);
          vanishedAt.delete(anchorTouchId);
          continue;
        }
        const resolvedKey = isAnchorTouch
          ? null
          : resolveKeyFromClientPoint(t.clientX, t.clientY, t.target, {
              preferTarget: false,
              preferNearest: true,
              nearestTolerancePx: touchNearestTolerancePx,
            });
        const lockedKeyId = lockedKeyByTouchId.get(t.identifier);
        const lockedKey = lockedKeyId
          ? keyById.get(lockedKeyId) ?? (lockedKeyId === ANCHOR_O_KEY.id ? ANCHOR_O_KEY : null)
          : null;
        const key = lockedKey ?? resolvedKey;
        const wasTracked = trackedTouchIds.has(t.identifier);
        const shouldTrack = wasTracked || !!key;
        if (!shouldTrack) continue;

        const pid = getTouchPid(t.identifier);
        if (key) {
          if (!lockedKeyId) lockedKeyByTouchId.set(t.identifier, key.id);
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
            lockedKeyByTouchId.delete(t.identifier);
            continue;
          }
          unresolvedFrames.set(t.identifier, missCount);
          nextTracked.add(t.identifier);
        }
      }

      for (const touchId of trackedTouchIds) {
        if (simulateAlwaysTouch && touchId === anchorTouchId) {
          nextTracked.add(touchId);
          continue;
        }
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
          lockedKeyByTouchId.delete(touchId);
        }
      }

      trackedTouchIds = nextTracked;
      if (!simulateAlwaysTouch) return trackedTouchIds.size > 0;
      for (const id of trackedTouchIds) {
        if (id !== anchorTouchId) return true;
      }
      return false;
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
      const now = performance.now();
      let bridgeArmed = false;
      let gapMs = -1;

      if (ev.type === 'touchstart' || ev.type === 'touchmove') {
        lastTouchActiveAtRef.current = now;
      }

      if (ev.type === 'touchstart' && touchGapBridgeMs > 0 && lastZeroTouchAt >= 0) {
        gapMs = now - lastZeroTouchAt;
        if (gapMs >= 0 && gapMs <= touchGapBridgeMs) {
          bridgeArmed = true;
          bridgeForceLockUntil = Math.max(bridgeForceLockUntil, now + touchGapBridgeMs);
          if (debugTouch) {
            dbg('touch:gap-bridge-arm', {
              gapMs: Math.round(gapMs),
              bridgeMs: touchGapBridgeMs,
              touches: ev.touches.length,
            });
          }
        }
      }

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
          lockedKeyByTouchId.delete(touchId);
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
          lockedKeyByTouchId.delete(touchId);

          const key = resolveKeyFromClientPoint(t.clientX, t.clientY, (t as any).target ?? ev.target, {
            preferTarget: true,
            preferNearest: true,
            nearestTolerancePx: touchNearestTolerancePx,
          });
          if (!key) continue;
          trackedTouchIds.add(touchId);
          lockedKeyByTouchId.set(touchId, key.id);
          unresolvedFrames.delete(touchId);
          vanishedAt.delete(touchId);
          pressKey(pid, key);
          bootstrapPressed = true;
        }
      }

      const hasActiveKeyboardTouch = reconcileTouches();

      // 仅在 touch 主通道已接管（或触摸结束）后再释放 fallback，避免同键出现“先按后放再按”的对消。
      if (
        fallbackTouchPointerPidsRef.current.size > 0 &&
        (bootstrapPressed || hasActiveKeyboardTouch || ev.type === 'touchend' || ev.type === 'touchcancel')
      ) {
        releaseFallbackTouchPointers();
      }

      // 触摸会话锁：即使最后一键刚抬起，也保留短暂防抖窗口，防止浏览器抢占输入链路。
      if (hitKeyboard || bootstrapPressed || hasActiveKeyboardTouch) {
        touchSessionLockUntil = now + touchSessionGraceMs;
      }
      if ((ev.type === 'touchend' || ev.type === 'touchcancel') && ev.touches.length === 0) {
        lastZeroTouchAt = now;
        touchSessionLockUntil = Math.max(touchSessionLockUntil, now + touchSessionGraceMs);
      }
      const touchSessionLocked = now < touchSessionLockUntil;
      const gapBridgeLocked = now < bridgeForceLockUntil;

      if (bridgeArmed && debugTouch) {
        dbg('touch:gap-bridge-lock', {
          lockMs: touchGapBridgeMs,
          sessionLocked: touchSessionLocked,
        });
      }

      if (strictTouchLock && ev.cancelable) {
        ev.preventDefault();
        return;
      }

      if (ev.cancelable && (hitKeyboard || bootstrapPressed || hasActiveKeyboardTouch || touchSessionLocked || gapBridgeLocked)) {
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
      lockedKeyByTouchId.clear();
      touchPidById.clear();
      releaseFallbackTouchPointers();
    };
  }, [
    editMode,
    fallbackTouchPointerPidsRef,
    kbRootRef,
    keyById,
    lastTouchActiveAtRef,
    pressKey,
    releaseFallbackTouchPointers,
    releasePointer,
    resolveKeyFromClientPoint,
    simulateAlwaysTouch,
    dbg,
    debugTouch,
    strictTouchLock,
    touchGapBridgeMs,
    touchPrimary,
  ]);
}
