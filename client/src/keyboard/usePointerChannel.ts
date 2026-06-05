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
  debugTouch: boolean;
  debugTouchMove: boolean;
  dbg: (event: string, data?: any) => void;
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
};

// Pointer 主通道：承接鼠标/触控笔输入，并在必要时为 touch 提供 fallback。
export function usePointerChannel(params: UsePointerChannelParams): void {
  const {
    editMode,
    debugTouch,
    debugTouchMove,
    dbg,
    kbAbsRef,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
    releaseAll,
  } = params;

  React.useEffect(() => {
    if (editMode) return;

    const onUp = (ev: PointerEvent) => {
      if ((ev as any).pointerType === 'touch') return;
      releasePointer(ev.pointerId);
    };

    const onBlur = () => {
      releaseAll('blur');
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') {
        releaseAll('hidden');
      }
    };

    const onGlobalDownCapture = (ev: PointerEvent) => {
      if ((ev as any).pointerType === 'touch') return;

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
    kbAbsRef,
    pressKey,
    releaseAll,
    releasePointer,
    resolveKeyFromClientPoint,
  ]);
}
