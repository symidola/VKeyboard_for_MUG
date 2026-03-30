import React from 'react';
import type { KeyboardKey, KeyboardLayout } from '@vkeyboard/shared';

function getUnitPx(layout: KeyboardLayout): number {
  return typeof layout.unitPx === 'number' && layout.unitPx > 10 ? layout.unitPx : 52;
}

function getGapPx(layout: KeyboardLayout): number {
  return typeof layout.gapPx === 'number' && layout.gapPx >= 0 ? layout.gapPx : 8;
}

function safeSearchParams(): URLSearchParams {
  try {
    return new URLSearchParams(window.location.search);
  } catch {
    return new URLSearchParams();
  }
}

type AbsBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  pad: number;
};

type AbsKeyRect = {
  key: KeyboardKey;
  left: number;
  top: number;
  width: number;
  height: number;
};

function describeTarget(t: EventTarget | null): {
  tag?: string;
  id?: string;
  cls?: string;
  text?: string;
} {
  const el = t as HTMLElement | null;
  if (!el || typeof (el as any).tagName !== 'string') return {};
  const tag = el.tagName;
  const id = el.id || undefined;
  const cls = typeof el.className === 'string' ? el.className : undefined;
  const text = (el.textContent || '').trim().slice(0, 40) || undefined;
  return { tag, id, cls, text };
}

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
  const debugTouch = React.useMemo(() => qs.has('debugTouch'), [qs]);
  const debugTouchMove = React.useMemo(() => qs.has('debugTouchMove'), [qs]);
  const logToServer = React.useMemo(() => qs.has('logToServer'), [qs]);

  const makeDebugLogUrl = React.useCallback((): string => {
    const override = qs.get('logUrl');
    if (override && /^https?:\/\//i.test(override)) return override;
    const isSecure = window.location.protocol === 'https:';
    const host = window.location.hostname;
    const proto = isSecure ? 'https' : 'http';
    return `${proto}://${host}:8080/debug/log`;
  }, [qs]);

  const pendingServerLinesRef = React.useRef<string[]>([]);
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
        pendingServerLinesRef.current.push(line);
        if (pendingServerLinesRef.current.length > 500) {
          pendingServerLinesRef.current.splice(0, pendingServerLinesRef.current.length - 500);
        }
      }
    },
    [debugTouch, logToServer, props.editMode],
  );

  React.useEffect(() => {
    if (!debugTouch || !logToServer || props.editMode) return;
    let stopped = false;
    dbg('logToServer:on', { url: makeDebugLogUrl() });

    const flush = async () => {
      if (stopped) return;
      const batch = pendingServerLinesRef.current.splice(0, 60);
      if (batch.length === 0) return;

      try {
        const url = makeDebugLogUrl();
        const resp = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lines: batch, ua: navigator.userAgent }),
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
  }, [dbg, debugTouch, logToServer, makeDebugLogUrl, props.editMode]);

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
  const keyById = React.useMemo(() => new Map(allKeys.map((k) => [k.id, k])), [allKeys]);
  const hasAbsolute = allKeys.some((k) => typeof k.x === 'number' || typeof k.y === 'number');

  // Multi-touch: track which pointer is holding which key.
  const activePointersRef = React.useRef<Map<number, string>>(new Map());
  const pressedKeysRef = React.useRef<Set<string>>(new Set());
  const [pressedKeys, setPressedKeys] = React.useState<Set<string>>(() => new Set());

  const isKeyPressed = React.useCallback((keyId: string): boolean => {
    return pressedKeysRef.current.has(keyId);
  }, []);

  const pressKey = React.useCallback(
    (pointerId: number, key: KeyboardKey) => {
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
      props.onKeyDown(key);
    },
    [dbg, debugTouch, isKeyPressed, props],
  );

  const releasePointer = React.useCallback(
    (pointerId: number) => {
      const keyId = activePointersRef.current.get(pointerId);
      if (!keyId) return;
      activePointersRef.current.delete(pointerId);

      // Only release when no other pointer holds this key.
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
      if (key) props.onKeyUp(key);
    },
    [dbg, debugTouch, isKeyPressed, keyById, props],
  );

  const releaseAll = React.useCallback(
    (reason: string) => {
      const pressed = Array.from(pressedKeysRef.current.values());
      activePointersRef.current.clear();
      pressedKeysRef.current.clear();
      setPressedKeys(new Set());

      if (debugTouch) dbg('releaseAll', { reason, pressed });
      for (const keyId of pressed) {
        const key = keyById.get(keyId);
        if (key) props.onKeyUp(key);
      }
    },
    [dbg, debugTouch, keyById, props],
  );

  // Scale-to-fit for absolute layouts (tablet-friendly).
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

  const absBounds: AbsBounds | null = React.useMemo(() => {
    if (!hasAbsolute) return null;
    let minX = 0;
    let minY = 0;
    let maxX = 0;
    let maxY = 0;

    for (const k of allKeys) {
      const x = typeof k.x === 'number' ? k.x : 0;
      const y = typeof k.y === 'number' ? k.y : 0;
      const w = Math.max(0.25, k.width);
      const h = Math.max(0.25, k.height);

      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }

    const pad = gapPx;
    const width = (maxX - minX) * pitch - gapPx + pad * 2;
    const height = (maxY - minY) * pitch - gapPx + pad * 2;
    return {
      minX,
      minY,
      width: Math.max(200, Math.ceil(width)),
      height: Math.max(unitPx, Math.ceil(height)),
      pad,
    };
  }, [allKeys, gapPx, hasAbsolute, pitch, unitPx]);

  const absKeyRects: AbsKeyRect[] | null = React.useMemo(() => {
    if (!hasAbsolute || !absBounds) return null;
    return allKeys.map((k) => {
      const w = Math.max(0.25, k.width);
      const h = Math.max(0.25, k.height);
      const x = typeof k.x === 'number' ? k.x : 0;
      const y = typeof k.y === 'number' ? k.y : 0;
      const keyWidthPx = unitPx * w + gapPx * (w - 1);
      const keyHeightPx = unitPx * h;
      return {
        key: k,
        left: absBounds.pad + (x - absBounds.minX) * pitch,
        top: absBounds.pad + (y - absBounds.minY) * pitch,
        width: keyWidthPx,
        height: keyHeightPx,
      };
    });
  }, [absBounds, allKeys, gapPx, hasAbsolute, pitch, unitPx]);

  React.useEffect(() => {
    if (props.editMode) return;

    const onUp = (ev: PointerEvent) => {
      releasePointer(ev.pointerId);
    };

    const onBlur = () => {
      releaseAll('blur');
    };

    const onVis = () => {
      if (document.visibilityState === 'hidden') releaseAll('hidden');
    };

    const onGlobalDownCapture = (ev: PointerEvent) => {
      if (!hasAbsolute || !absBounds || !absKeyRects) return;
      if (activePointersRef.current.has(ev.pointerId)) return;
      const el = kbAbsRef.current;
      if (!el) return;

      const target = ev.target as HTMLElement | null;
      if (target && (target as any).closest?.('button.key')) return;

      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const xClient = ev.clientX;
      const yClient = ev.clientY;
      if (xClient < rect.left || xClient > rect.right || yClient < rect.top || yClient > rect.bottom) return;

      const nx = (xClient - rect.left) / rect.width;
      const ny = (yClient - rect.top) / rect.height;
      if (nx < 0 || nx > 1 || ny < 0 || ny > 1) return;

      const x = nx * absBounds.width;
      const y = ny * absBounds.height;

      let best: { key: KeyboardKey; dist2: number } | null = null;
      for (const r of absKeyRects) {
        const dx = x < r.left ? r.left - x : x > r.left + r.width ? x - (r.left + r.width) : 0;
        const dy = y < r.top ? r.top - y : y > r.top + r.height ? y - (r.top + r.height) : 0;
        const dist2 = dx * dx + dy * dy;
        if (!best || dist2 < best.dist2) best = { key: r.key, dist2 };
        if (dist2 === 0) break;
      }

      if (!best) return;
      const tol = Math.max(absBounds.pad, gapPx, 12) + 6;
      if (best.dist2 > tol * tol) return;

      try {
        el.setPointerCapture?.(ev.pointerId);
      } catch {
        // ignore
      }

      if (debugTouch) {
        dbg('abs:win-press', {
          pointerId: ev.pointerId,
          keyId: best.key.id,
          label: best.key.label,
          dist2: Math.round(best.dist2),
          target: describeTarget(ev.target),
        });
      }

      pressKey(ev.pointerId, best.key);
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
  }, [absBounds, absKeyRects, dbg, debugTouch, debugTouchMove, gapPx, hasAbsolute, pressKey, props.editMode, releaseAll, releasePointer]);

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

  const renderKeyButton = (k: KeyboardKey, style: React.CSSProperties) => {
    const isSelected = props.editMode && props.selectedKeyId === k.id;
    const isPressed = pressedKeys.has(k.id);
    return (
      <button
        key={k.id}
        className={['key', isSelected ? 'selected' : '', isPressed ? 'pressed' : ''].join(' ')}
        style={style}
        onContextMenu={(ev) => ev.preventDefault()}
        onClick={() => {
          if (props.editMode) props.onSelectKey(k.id);
        }}
        onPointerDown={(ev) => {
          ev.preventDefault();
          (ev.currentTarget as HTMLElement).setPointerCapture?.(ev.pointerId);
          if (props.editMode) {
            props.onSelectKey(k.id);
            return;
          }
          pressKey(ev.pointerId, k);
        }}
        onPointerUp={(ev) => {
          ev.preventDefault();
          if (props.editMode) return;
          releasePointer(ev.pointerId);
        }}
        onPointerCancel={(ev) => {
          ev.preventDefault();
          if (props.editMode) return;
          releasePointer(ev.pointerId);
        }}
        onLostPointerCapture={(ev) => {
          ev.preventDefault();
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
      <div className="kb" style={{ overflowX: 'auto' }}>
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
                      };

                      return renderKeyButton(k, style);
                    })}
                  </div>
                </div>
              );
            })()}
          </div>
        ) : (
          props.layout.rows.map((row) => (
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
          ))
        )}
      </div>
      {dbgPanel}
    </>
  );
}
