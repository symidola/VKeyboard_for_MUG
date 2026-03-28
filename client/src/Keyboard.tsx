import React from 'react';
import type { KeyboardLayout, KeyboardKey } from '@vkeyboard/shared';

function getUnitPx(layout: KeyboardLayout): number {
  return typeof layout.unitPx === 'number' && layout.unitPx > 10 ? layout.unitPx : 52;
}

function getGapPx(layout: KeyboardLayout): number {
  return typeof layout.gapPx === 'number' && layout.gapPx >= 0 ? layout.gapPx : 8;
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

  const allKeys = React.useMemo(() => props.layout.rows.flatMap((r) => r.keys), [props.layout]);
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
      props.onKeyDown(key);
    },
    [isKeyPressed, props],
  );

  const releaseKey = React.useCallback(
    (pointerId: number, key: KeyboardKey) => {
      const mapped = activePointersRef.current.get(pointerId);
      if (mapped !== key.id) {
        activePointersRef.current.delete(pointerId);
        return;
      }
      activePointersRef.current.delete(pointerId);

      // Only release when no other pointer holds this key.
      for (const kid of activePointersRef.current.values()) {
        if (kid === key.id) return;
      }

      if (!isKeyPressed(key.id)) return;
      pressedKeysRef.current.delete(key.id);
      setPressedKeys((prev) => {
        if (!prev.has(key.id)) return prev;
        const next = new Set(prev);
        next.delete(key.id);
        return next;
      });
      props.onKeyUp(key);
    },
    [isKeyPressed, props],
  );

  // Scale-to-fit for absolute layouts (tablet-friendly).
  const wrapRef = React.useRef<HTMLDivElement | null>(null);
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

  const absBounds = React.useMemo(() => {
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

  return (
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
                const isSelected = props.editMode && props.selectedKeyId === k.id;
            const isPressed = pressedKeys.has(k.id);
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
                  releaseKey(ev.pointerId, k);
                }}
                onPointerCancel={(ev) => {
                  ev.preventDefault();
                  if (props.editMode) return;
                  releaseKey(ev.pointerId, k);
                }}
              >
                {k.label}
              </button>
            );
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
              const isSelected = props.editMode && props.selectedKeyId === k.id;
              const isPressed = pressedKeys.has(k.id);
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
                    releaseKey(ev.pointerId, k);
                  }}
                  onPointerCancel={(ev) => {
                    ev.preventDefault();
                    if (props.editMode) return;
                    releaseKey(ev.pointerId, k);
                  }}
                >
                  {k.label}
                </button>
              );
            })}
          </div>
        ))
      )}
    </div>
  );
}
