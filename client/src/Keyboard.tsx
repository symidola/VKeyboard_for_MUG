import React from 'react';
import type { KeyboardKey, KeyboardLayout } from '@vkeyboard/shared';
import { KEY_SELECTOR } from './keyboard/constants';
import {
  computeAbsBounds,
  computeAbsKeyRects,
  getGapPx,
  getUnitPx,
  makeDebugLogUrl as buildDebugLogUrl,
  readKeyboardRuntimeFlags,
  safeSearchParams,
} from './keyboard/helpers';
import type { AbsBounds, AbsKeyRect } from './keyboard/types';
import { usePointerChannel } from './keyboard/usePointerChannel';
import { useTouchChannel } from './keyboard/useTouchChannel';
import { TOUCH_FAILURE_MITIGATION_DISABLED, getTouchMitigationConfig } from './keyboard/touchFailureMitigations';

const VKDBG_BUILD_TAG = 'vkdbg-2026-04-04-b';

export function Keyboard(props: {
  layout: KeyboardLayout;
  selectedKeyId?: string;
  editMode: boolean;
  onSelectKey: (keyId: string) => void;
  onKeyDown: (k: KeyboardKey) => void;
  onKeyUp: (k: KeyboardKey) => void;
}): React.ReactElement {
  const unitPx = getUnitPx(props.layout);
  const gapPx = getGapPx(props.layout);
  const pitch = unitPx + gapPx;

  const qs = React.useMemo(() => safeSearchParams(), []);
  const {
    debugTouch,
    debugTouchMove,
    logToServer,
    touchPrimary,
  } =
    React.useMemo(() => readKeyboardRuntimeFlags(qs), [qs]);
  const mitigationConfig = React.useMemo(() => getTouchMitigationConfig(), []);

  // 生成调试日志上报地址，支持 URL 参数覆盖。
  const makeDebugLogUrl = React.useCallback((): string => {
    return buildDebugLogUrl(qs);
  }, [qs]);

  const pendingServerLinesRef = React.useRef<string[]>([]);
  const lastServerLineRef = React.useRef<{ line: string; at: number } | null>(null);
  const lastServerKeyEdgeAtRef = React.useRef<Map<string, number>>(new Map());
  const [dbgLines, setDbgLines] = React.useState<string[]>(() => {
    if (!debugTouch) return [];
    return [`${new Date().toLocaleTimeString()} [vkdbg] enabled search=${window.location.search || ''}`];
  });

  const dbgPushRef = React.useRef<(line: string) => void>(() => {});
  dbgPushRef.current = (line: string) => {
    if (!debugTouch) return;
    const ts = new Date().toLocaleTimeString();
    const full = `${ts} ${line}`;
    setDbgLines((prev) => {
      const next = prev.length >= 400 ? prev.slice(prev.length - 399) : prev.slice();
      next.push(full);
      return next;
    });
  };

  // 调试日志入口：统一格式化并按条件入本地面板/服务端缓冲队列。
  const dbg = React.useCallback(
    (event: string, data?: any) => {
      if (!debugTouch) return;
      let extra = '';
      if (data !== undefined) {
        try {
          extra = ' ' + JSON.stringify(data);
        } catch {
          extra = ' ' + String(data);
        }
      }
      const line = `${event}${extra}`;
      dbgPushRef.current(line);
      if (logToServer && !props.editMode) {
        const wsStatus =
          data && typeof data === 'object' && 'wsStatus' in (data as Record<string, unknown>)
            ? (data as Record<string, unknown>).wsStatus
            : undefined;

        // 过滤高频/内部状态日志，保留按键链路和异常日志。
        const skipServerLog =
          event.startsWith('logToServer:') ||
          (event === 'ws:send' && wsStatus === 'connected') ||
          event === 'lostpointercapture' ||
          event === 'touch:pointer-fallback-down' ||
          event === 'window:pointerdown' ||
          event === 'window:pointerup' ||
          event === 'window:pointermove';
        if (skipServerLog) return;

        // 同一行短时间重复出现通常是噪声，避免占满上报队列。
        const now = performance.now();

        // 按键边沿去重：同键同事件极短时间重复一般是通道并发噪声。
        if ((event === 'press' || event === 'release') && data && typeof data === 'object') {
          const maybeKeyId = (data as Record<string, unknown>).keyId;
          if (typeof maybeKeyId === 'string' && maybeKeyId) {
            const sig = `${event}:${maybeKeyId}`;
            const lastAt = lastServerKeyEdgeAtRef.current.get(sig);
            if (lastAt != null && now - lastAt < 42) {
              return;
            }
            lastServerKeyEdgeAtRef.current.set(sig, now);
            if (lastServerKeyEdgeAtRef.current.size > 128) {
              // 控制内存占用，保留最近写入的键边沿。
              const first = lastServerKeyEdgeAtRef.current.keys().next().value;
              if (first) lastServerKeyEdgeAtRef.current.delete(first);
            }
          }
        }

        const last = lastServerLineRef.current;
        if (last && last.line === line && now - last.at < 120) {
          return;
        }
        lastServerLineRef.current = { line, at: now };

        pendingServerLinesRef.current.push(line);
        if (pendingServerLinesRef.current.length > 300) {
          pendingServerLinesRef.current.splice(0, pendingServerLinesRef.current.length - 300);
        }
      }
    },
    [debugTouch, logToServer, props.editMode],
  );

  // 调试模式下将本地日志批量上报到服务端，失败时保留队列以便重试。
  React.useEffect(() => {
    if (!debugTouch || !logToServer || props.editMode) return;
    let stopped = false;
    dbg('runtime:flags', {
      build: VKDBG_BUILD_TAG,
      touchPrimary,
      touchFailureMitigationDisabled: true,
      touchFailureMitigation: TOUCH_FAILURE_MITIGATION_DISABLED,
      debugTouchMove,
      search: window.location.search || '',
    });
    dbg('logToServer:on', { url: makeDebugLogUrl() });

    // 周期性冲刷日志队列，降低网络请求频率。
    const flush = async () => {
      if (stopped) return;
      const batch = pendingServerLinesRef.current.splice(0, 60);
      if (batch.length === 0) return;

      try {
        const url = makeDebugLogUrl();
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: batch }),
          keepalive: true,
        });
        if (!resp.ok) {
          dbg('logToServer:flush-fail', { status: resp.status });
          throw new Error(`HTTP ${resp.status}`);
        }
        dbg('logToServer:flush-ok', { written: batch.length });
      } catch {
        dbg('logToServer:flush-error', { kept: batch.length });
        const keep = batch.concat(pendingServerLinesRef.current);
        pendingServerLinesRef.current = keep.slice(0, 300);
      }
    };

    const id = window.setInterval(flush, 500);
    return () => {
      stopped = true;
      window.clearInterval(id);
      void flush();
    };
  }, [
    dbg,
    debugTouch,
    debugTouchMove,
    logToServer,
    makeDebugLogUrl,
    props.editMode,
    touchPrimary,
  ]);

  // 非编辑模式下锁定视口手势，避免双指缩放或滚动干扰按键。
  React.useEffect(() => {
    if (props.editMode) return;

    document.body.classList.add('vkLockViewport');

    const onGesture = (ev: Event) => ev.preventDefault();
    const onTouchMove = (ev: TouchEvent) => ev.preventDefault();
    const onWheel = (ev: WheelEvent) => {
      if (ev.ctrlKey) ev.preventDefault();
    };

    document.addEventListener('gesturestart', onGesture as any, { passive: false } as any);
    document.addEventListener('gesturechange', onGesture as any, { passive: false } as any);
    document.addEventListener('gestureend', onGesture as any, { passive: false } as any);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    window.addEventListener('wheel', onWheel, { passive: false } as any);

    return () => {
      document.body.classList.remove('vkLockViewport');
      document.removeEventListener('gesturestart', onGesture as any);
      document.removeEventListener('gesturechange', onGesture as any);
      document.removeEventListener('gestureend', onGesture as any);
      document.removeEventListener('touchmove', onTouchMove as any);
      window.removeEventListener('wheel', onWheel as any);
    };
  }, [props.editMode]);

  const allKeys = React.useMemo(() => props.layout.rows.flatMap((r) => r.keys), [props.layout]);
  const keyById = React.useMemo(() => {
    return new Map(allKeys.map((k) => [k.id, k]));
  }, [allKeys]);
  const hasAbsolute = allKeys.some((k) => typeof k.x === 'number' || typeof k.y === 'number');

  // Multi-touch: track which pointer is holding which key.
  const activePointersRef = React.useRef<Map<number, string>>(new Map());
  const pressedKeysRef = React.useRef<Set<string>>(new Set());
  const mutedKeyIdsRef = React.useRef<Set<string>>(new Set());
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(() => new Set());

  // 查询某个 key 是否处于按下态。
  const isKeyPressed = React.useCallback((keyId: string): boolean => {
    return pressedKeysRef.current.has(keyId);
  }, []);

  // 触发按下事件前先过滤静默键。
  const emitKeyDown = React.useCallback(
    (key: KeyboardKey) => {
      if (mutedKeyIdsRef.current.has(key.id)) return;
      props.onKeyDown(key);
    },
    [props.onKeyDown],
  );

  // 触发抬起事件前先过滤静默键。
  const emitKeyUp = React.useCallback(
    (key: KeyboardKey) => {
      if (mutedKeyIdsRef.current.has(key.id)) return;
      props.onKeyUp(key);
    },
    [props.onKeyUp],
  );

  // 处理 pointer 按下/滑移到新键：必要时先释放旧键，再按下新键。
  const pressKey = React.useCallback(
    (pointerId: number, key: KeyboardKey) => {
      const prevKeyId = activePointersRef.current.get(pointerId);
      if (prevKeyId === key.id) {
        return;
      }
      if (prevKeyId) {
        activePointersRef.current.delete(pointerId);
        let prevStillHeld = false;
        for (const kid of activePointersRef.current.values()) {
          if (kid === prevKeyId) {
            prevStillHeld = true;
            break;
          }
        }

        if (!prevStillHeld && isKeyPressed(prevKeyId)) {
          pressedKeysRef.current.delete(prevKeyId);
          setPressedKeys((prev) => {
            if (!prev.has(prevKeyId)) return prev;
            const next = new Set(prev);
            next.delete(prevKeyId);
            return next;
          });

          const prevKey = keyById.get(prevKeyId);
          if (debugTouch) {
            dbg('release:remap', {
              pointerId,
              fromKeyId: prevKeyId,
              fromLabel: prevKey?.label,
              toKeyId: key.id,
              toLabel: key.label,
            });
          }
          if (prevKey) props.onKeyUp(prevKey);
        }
      }

      activePointersRef.current.set(pointerId, key.id);

      if (isKeyPressed(key.id)) return;

      pressedKeysRef.current.add(key.id);
      setPressedKeys((prev) => {
        if (prev.has(key.id)) return prev;
        const next = new Set(prev);
        next.add(key.id);
        return next;
      });

      if (debugTouch) dbg('press', { pointerId, keyId: key.id, label: key.label });
      emitKeyDown(key);
    },
    [dbg, debugTouch, emitKeyDown, isKeyPressed, keyById, props.onKeyUp],
  );

  // 释放指定 pointer 对应的键；若该键仍被其他 pointer 持有则不抬起。
  const releasePointer = React.useCallback(
    (pointerId: number) => {
      const keyId = activePointersRef.current.get(pointerId);
      if (!keyId) return;
      activePointersRef.current.delete(pointerId);

      // 只有当没有其他 pointer 持有该键时才真正抬起。
      for (const kid of activePointersRef.current.values()) {
        if (kid === keyId) return;
      }

      if (!isKeyPressed(keyId)) return;
      pressedKeysRef.current.delete(keyId);
      setPressedKeys((prev) => {
        if (!prev.has(keyId)) return prev;
        const next = new Set(prev);
        next.delete(keyId);
        return next;
      });

      const key = keyById.get(keyId);
      if (debugTouch) dbg('release', { pointerId, keyId, label: key?.label });
      if (key) emitKeyUp(key);
    },
    [dbg, debugTouch, emitKeyUp, isKeyPressed, keyById],
  );

  // 紧急释放全部按键（失焦/切后台等场景）。
  const releaseAll = React.useCallback(
    (reason: string) => {
      const pressed = Array.from(pressedKeysRef.current.values());
      activePointersRef.current.clear();
      pressedKeysRef.current.clear();
      setPressedKeys(new Set());

      if (debugTouch) dbg('releaseAll', { reason, pressed });
      for (const keyId of pressed) {
        const key = keyById.get(keyId);
        if (key) emitKeyUp(key);
      }
    },
    [dbg, debugTouch, emitKeyUp, keyById],
  );

  // Scale-to-fit for absolute layouts (tablet-friendly).
  const kbRootRef = React.useRef<HTMLDivElement | null>(null);
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
  const kbAbsRef = React.useRef<HTMLDivElement | null>(null);
  const [wrapWidth, setWrapWidth] = React.useState<number>(0);

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;

    const ro = new ResizeObserver(() => {
      setWrapWidth(el.clientWidth);
    });
    ro.observe(el);
    setWrapWidth(el.clientWidth);
    return () => ro.disconnect();
  }, []);

  const absBounds: AbsBounds | null = React.useMemo(
    () => computeAbsBounds(allKeys, hasAbsolute, gapPx, pitch, unitPx),
    [allKeys, gapPx, hasAbsolute, pitch, unitPx],
  );

  const absKeyRects: AbsKeyRect[] | null = React.useMemo(
    () => computeAbsKeyRects(allKeys, hasAbsolute, absBounds, unitPx, gapPx, pitch),
    [absBounds, allKeys, gapPx, hasAbsolute, pitch, unitPx],
  );

  // When any key uses semiX, DOM-based resolution is unreliable because
  // border-radius clipping and stacking means the wrong element may match.
  const hasSemiX = React.useMemo(() => allKeys.some((k) => k.semiX), [allKeys]);

  // 通过目标元素+坐标综合命中按键，支持最近邻兜底和绝对布局命中。
  const resolveKeyFromClientPoint = React.useCallback(
    (
      xClient: number,
      yClient: number,
      target?: EventTarget | null,
      options?: { preferTarget?: boolean; preferNearest?: boolean; nearestTolerancePx?: number },
    ): KeyboardKey | null => {
      const preferTarget = options?.preferTarget ?? true;
      const preferNearest = options?.preferNearest ?? true;

      const absHit = (): KeyboardKey | null => {
        if (!hasAbsolute || !absBounds || !absKeyRects) return null;
        const el = kbAbsRef.current;
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        if (!rect.width || !rect.height) return null;
        const nx = (xClient - rect.left) / rect.width;
        const ny = (yClient - rect.top) / rect.height;
        if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return null;
        const x = nx * absBounds.width;
        const y = ny * absBounds.height;
        // Circle keys sorted first so Don wins over overlapping Ka rect.
        const sorted = [...absKeyRects].sort((a, b) => {
          const ai = a.key.shape === 'circle' ? 0 : 1;
          const bi = b.key.shape === 'circle' ? 0 : 1;
          return ai - bi;
        });
        let best: { key: KeyboardKey; dist2: number } | null = null;
        for (const r of sorted) {
          let dx: number;
          let dy: number;
          if (r.key.shape === 'circle') {
            const cx = r.left + r.width / 2;
            const cy = r.top + r.height / 2;
            const radius = Math.min(r.width, r.height) / 2;
            const ndx = (x - cx) / radius;
            const ndy = (y - cy) / radius;
            const inCircle = ndx * ndx + ndy * ndy <= 1.05;
            const semiOk = !r.key.semiX || (r.key.semiX === 'left' ? x < cx : x >= cx);
            if (inCircle && semiOk) { dx = 0; dy = 0; }
            else if (inCircle && !semiOk) { continue; }
            else {
              const d = Math.sqrt(ndx * ndx + ndy * ndy);
              dx = (ndx / d - 1) * radius;
              dy = (ndy / d - 1) * radius;
            }
          } else {
            dx = x < r.left ? r.left - x : x > r.left + r.width ? x - (r.left + r.width) : 0;
            dy = y < r.top ? r.top - y : y > r.top + r.height ? y - (r.top + r.height) : 0;
          }
          const dist2 = dx * dx + dy * dy;
          if (!best || dist2 < best.dist2) best = { key: r.key, dist2 };
          if (dist2 === 0) break;
        }
        if (!best) return null;
        const tol = Math.max(absBounds.pad, gapPx, 12) + 6;
        return best.dist2 <= tol * tol ? best.key : null;
      };

      if (preferTarget && !hasSemiX) {
        const fromTarget = (target as HTMLElement | null)?.closest?.(KEY_SELECTOR) as HTMLElement | null;
        const fromTargetKeyId = fromTarget?.dataset?.keyid;
        if (fromTargetKeyId) {
          const hit = keyById.get(fromTargetKeyId);
          if (hit && !hit.semiX) return hit;
        }
      }

      const fromPointKeyId = !hasSemiX
        ? (document
            .elementFromPoint(xClient, yClient)
            ?.closest?.(KEY_SELECTOR) as HTMLElement | null)?.dataset?.keyid
        : undefined;
      if (fromPointKeyId) {
        const hit = keyById.get(fromPointKeyId);
        if (hit && !hit.semiX) return hit;
      }

      // Absolute hit test runs before nearest-DOM so circle+semiX keys
      // resolve via coordinates, not DOM stacking order.
      const absResult = absHit();
      if (absResult) return absResult;

      if (preferNearest) {
        const nodes = document.querySelectorAll(KEY_SELECTOR);
        let bestDom: { key: KeyboardKey; dist2: number } | null = null;
        for (const node of Array.from(nodes)) {
          const keyId = (node as HTMLElement).dataset?.keyid;
          if (!keyId) continue;
          const key = keyById.get(keyId);
          if (!key) continue;
          if (key.semiX) continue;
          const rect = (node as HTMLElement).getBoundingClientRect();
          if (!rect.width || !rect.height) continue;

          const dx = xClient < rect.left ? rect.left - xClient : xClient > rect.right ? xClient - rect.right : 0;
          const dy = yClient < rect.top ? rect.top - yClient : yClient > rect.bottom ? yClient - rect.bottom : 0;
          const dist2 = dx * dx + dy * dy;
          if (!bestDom || dist2 < bestDom.dist2) bestDom = { key, dist2 };
          if (dist2 === 0) break;
        }

        if (bestDom) {
          const domTol = Math.max(options?.nearestTolerancePx ?? 0, Math.max(gapPx + 10, 18));
          if (bestDom.dist2 <= domTol * domTol) return bestDom.key;
        }
      }

      return null;
    },
    [absBounds, absKeyRects, gapPx, hasAbsolute, keyById],
  );

  usePointerChannel({
    editMode: props.editMode,
    debugTouch,
    debugTouchMove,
    dbg,
    kbAbsRef,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
    releaseAll,
    touchPointerFallback: mitigationConfig.touchPointerFallback,
  });

  useTouchChannel({
    editMode: props.editMode,
    touchPrimary,
    keyById,
    debugTouch,
    dbg,
    resolveKeyFromClientPoint,
    pressKey,
    releasePointer,
  });

  // 暴露全局调试对象，便于外部快速抓取触摸链路状态。
  React.useEffect(() => {
    if (!debugTouch) return;
    (window as any).__VKDBG__ = {
      getState: () => ({ lines: dbgLines.slice() }),
      clear: () => setDbgLines([]),
      log: (event: string, data?: any) => dbg(event, data),
    };
    return () => {
      try {
        if ((window as any).__VKDBG__) delete (window as any).__VKDBG__;
      } catch {
        // ignore
      }
    };
  }, [dbg, dbgLines, debugTouch]);

  // 调试面板：仅在 debugTouch 开启时显示。
  const dbgPanel = debugTouch ? (
    <div
      style={{
        position: 'fixed',
        left: 8,
        right: 8,
        bottom: 8,
        maxHeight: '35vh',
        overflow: 'hidden',
        pointerEvents: 'none',
        zIndex: 999999,
        fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
        fontSize: 11,
        color: 'var(--text)',
      }}
    >
      <div
        style={{
          background: 'var(--panel)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderRadius: 8,
          padding: 8,
          overflow: 'auto',
          maxHeight: '35vh',
          whiteSpace: 'pre-wrap',
        }}
      >
        {dbgLines.slice(-80).join('\n')}
      </div>
    </div>
  ) : null;

  // 统一渲染单个按键，并绑定按压/释放/编辑选择事件。
  const renderKeyButton = (k: KeyboardKey, style: React.CSSProperties) => {
    const isSelected = props.editMode && props.selectedKeyId === k.id;
    const isPressed = pressedKeys.has(k.id);
    return (
      <button
        key={k.id}
        data-keyid={k.id}
        className={['key', isSelected ? 'selected' : '', isPressed ? 'pressed' : ''].join(' ')}
        style={style}
        onContextMenu={(ev) => ev.preventDefault()}
        onClick={() => {
          if (props.editMode) props.onSelectKey(k.id);
        }}
        onPointerDown={(ev) => {
          const isTouch = (ev as any).pointerType === 'touch';
          if (isTouch && !mitigationConfig.touchPointerFallback) {
            ev.preventDefault();
            return;
          }
          ev.preventDefault();
          (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
          if (props.editMode) {
            props.onSelectKey(k.id);
            return;
          }
          // For semiX keys the visible button is not necessarily the
          // correct one — resolve from coordinates to pick the right half.
          const effectiveKey = k.semiX
            ? resolveKeyFromClientPoint(ev.clientX, ev.clientY, ev.target, { preferTarget: false, preferNearest: false })
            : k;
          if (effectiveKey) pressKey(ev.pointerId, effectiveKey);
        }}
        onPointerUp={(ev) => {
          const isTouch = (ev as any).pointerType === 'touch';
          if (!isTouch || mitigationConfig.touchPointerFallback) {
            ev.preventDefault();
          }
          if (props.editMode) return;
          releasePointer(ev.pointerId);
        }}
        onPointerCancel={(ev) => {
          const isTouch = (ev as any).pointerType === 'touch';
          if (!isTouch || mitigationConfig.touchPointerFallback) {
            ev.preventDefault();
          }
          if (props.editMode) return;
          releasePointer(ev.pointerId);
        }}
        onLostPointerCapture={(ev) => {
          const isTouch = (ev as any).pointerType === 'touch';
          if (!isTouch || mitigationConfig.touchPointerFallback) {
            ev.preventDefault();
          }
          if (props.editMode) return;
          if (debugTouch) dbg('lostpointercapture', { pointerId: ev.pointerId, keyId: k.id });
          releasePointer(ev.pointerId);
        }}
      >
        {k.label}
      </button>
    );
  };

  return (
    <>
      <div ref={kbRootRef} className="kb" style={{ overflowX: 'auto' }}>
        {hasAbsolute && absBounds ? (
          <div ref={wrapRef} style={{ width: '100%', overflowX: 'auto' }}>
            {(() => {
              const maxScale = 2.5;
              const minScale = 1;
              const pad = 16;
              const available = Math.max(0, wrapWidth - pad * 2);
              const scaleRaw = absBounds.width > 0 ? available / absBounds.width : 1;
              const scale = Math.max(minScale, Math.min(maxScale, scaleRaw || 1));
              const scaledW = Math.ceil(absBounds.width * scale);
              const scaledH = Math.ceil(absBounds.height * scale);

              return (
                <div style={{ width: scaledW, height: scaledH }}>
                  <div
                    ref={kbAbsRef}
                    className="kbAbs"
                    style={{
                      position: 'relative',
                      width: `${absBounds.width}px`,
                      height: `${absBounds.height}px`,
                      transform: `scale(${scale})`,
                      transformOrigin: 'top left',
                    }}
                  >
                    {allKeys.map((k) => {
                      const w = Math.max(0.25, k.width);
                      const h = Math.max(0.25, k.height);
                      const keyWidthPx = unitPx * w + gapPx * (w - 1);
                      const keyHeightPx = unitPx * h;
                      const x = typeof k.x === 'number' ? k.x : 0;
                      const y = typeof k.y === 'number' ? k.y : 0;

                      const style: React.CSSProperties = {
                        position: 'absolute',
                        left: `${absBounds.pad + (x - absBounds.minX) * pitch}px`,
                        top: `${absBounds.pad + (y - absBounds.minY) * pitch}px`,
                        width: `${keyWidthPx}px`,
                        height: `${keyHeightPx}px`,
                        ...(k.shape === 'circle'
                          ? { borderRadius: '50%', zIndex: 1, padding: 0, boxSizing: 'border-box' }
                          : {}),
                      };

                      return renderKeyButton(k, style);
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          <>
            {props.layout.rows.map((row) => (
              <div className="kbRow" key={row.id} style={{ gap: `${gapPx}px` }}>
                {row.keys.map((k) => {
                  const w = Math.max(0.25, k.width);
                  const h = Math.max(0.25, k.height);
                  const keyWidthPx = unitPx * w + gapPx * (w - 1);
                  const keyHeightPx = unitPx * h;
                  const gapBefore = typeof k.gapBefore === 'number' ? k.gapBefore : 0;
                  const marginLeftPx = gapBefore > 0 ? gapBefore * pitch : 0;

                  const style: React.CSSProperties = {
                    width: `${keyWidthPx}px`,
                    height: `${keyHeightPx}px`,
                    marginLeft: marginLeftPx ? `${marginLeftPx}px` : undefined,
                  };

                  return renderKeyButton(k, style);
                })}
              </div>
            ))}
          </>
        )}
      </div>
      {dbgPanel}
    </>
  );
}
