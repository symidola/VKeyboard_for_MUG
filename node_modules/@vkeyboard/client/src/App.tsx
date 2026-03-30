import React from 'react';
import type { ClientRole, KeyboardKey, KeyboardLayout, KeyEventMessage, ServerToClientMessage } from '@vkeyboard/shared';
import { djmax8bLayout } from './layouts/djmax8b';
import { createClientSocket, type WsStatus } from './ws';
import { Keyboard } from './Keyboard';

type Mode = 'keyboard' | 'receiver';

type LayoutStorage = {
  theme: 'dark' | 'light';
  layout: KeyboardLayout;
};

function loadStorage(): LayoutStorage {
  const raw = localStorage.getItem('vkeyboard_state');
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as LayoutStorage;
      if (parsed?.layout?.rows?.length) {
        return parsed;
      }
    } catch {
      // ignore
    }
  }
  return { theme: 'dark', layout: djmax8bLayout };
}

function saveStorage(state: LayoutStorage): void {
  localStorage.setItem('vkeyboard_state', JSON.stringify(state));
}

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function clampInt(n: number, min: number, max: number): number {
  return Math.trunc(clamp(n, min, max));
}

function updateKey(layout: KeyboardLayout, keyId: string, patch: Partial<KeyboardKey>): KeyboardLayout {
  return {
    ...layout,
    rows: layout.rows.map((r) => ({
      ...r,
      keys: r.keys.map((k) => (k.id === keyId ? { ...k, ...patch } : k)),
    })),
  };
}

function updateLayout(layout: KeyboardLayout, patch: Partial<KeyboardLayout>): KeyboardLayout {
  return { ...layout, ...patch };
}

function normalizeLayout(input: KeyboardLayout): KeyboardLayout {
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

export function App(): React.ReactElement {
  const [isPhone, setIsPhone] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia?.('(max-width: 820px) and (pointer: coarse)').matches ?? false;
  });

  const [isPortrait, setIsPortrait] = React.useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.innerHeight > window.innerWidth;
  });

  const [mode, setMode] = React.useState<Mode>('keyboard');
  const [wsStatus, setWsStatus] = React.useState<WsStatus>('disconnected');
  const [clientsCount, setClientsCount] = React.useState(0);

  const [editMode, setEditMode] = React.useState(false);
  const [selectedKeyId, setSelectedKeyId] = React.useState<string | undefined>(undefined);

  const [theme, setTheme] = React.useState<'dark' | 'light'>(() => loadStorage().theme);
  const [layout, setLayout] = React.useState<KeyboardLayout>(() => normalizeLayout(loadStorage().layout));
  const [layoutJson, setLayoutJson] = React.useState(() => JSON.stringify(normalizeLayout(loadStorage().layout), null, 2));
  const [layoutJsonTouched, setLayoutJsonTouched] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);

  const [recvLog, setRecvLog] = React.useState<string[]>([]);

  React.useEffect(() => {
    const update = () => {
      setIsPortrait(window.innerHeight > window.innerWidth);
      setIsPhone(window.matchMedia?.('(max-width: 820px) and (pointer: coarse)').matches ?? false);
    };
    update();
    window.addEventListener('resize', update);
    window.addEventListener('orientationchange', update as any);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('orientationchange', update as any);
    };
  }, []);

  React.useEffect(() => {
    if (!isPhone) return;
    if (mode !== 'keyboard') setMode('keyboard');
    if (editMode) setEditMode(false);
    if (selectedKeyId) setSelectedKeyId(undefined);
  }, [editMode, isPhone, mode, selectedKeyId]);

  React.useEffect(() => {
    document.body.dataset.theme = theme;
    saveStorage({ theme, layout });
  }, [theme, layout]);

  React.useEffect(() => {
    if (!layoutJsonTouched) {
      setLayoutJson(JSON.stringify(layout, null, 2));
    }
  }, [layout, layoutJsonTouched]);

  const role: ClientRole = mode;

  const socketRef = React.useRef<ReturnType<typeof createClientSocket> | null>(null);

  React.useEffect(() => {
    socketRef.current?.close();
    socketRef.current = createClientSocket({
      role,
      deviceName: navigator.userAgent,
      onStatus: setWsStatus,
      onMessage: (msg: ServerToClientMessage) => {
        if (msg.type === 'state') {
          setClientsCount(msg.clients.length);
          return;
        }
        if (msg.type === 'key' && mode === 'receiver') {
          const line = `${new Date(msg.ts).toLocaleTimeString()}  ${msg.action}  ${msg.label} (${msg.keyId})`;
          setRecvLog((prev) => [line, ...prev].slice(0, 50));
        }
      },
    });

    return () => {
      socketRef.current?.close();
      socketRef.current = null;
    };
  }, [role, mode]);

  function sendKey(action: KeyEventMessage['action'], k: KeyboardKey): void {
    const msg: KeyEventMessage = {
      type: 'key',
      action,
      keyId: k.id,
      label: k.label,
      code: k.code,
      ts: Date.now(),
    };
    const ok = socketRef.current?.send(msg) ?? false;
    (window as any).__VKDBG__?.log?.(ok ? 'ws:send' : 'ws:drop', {
      action,
      keyId: k.id,
      label: k.label,
      wsStatus,
    });
  }

  const selectedKey = selectedKeyId
    ? layout.rows.flatMap((r) => r.keys).find((k) => k.id === selectedKeyId)
    : undefined;

  const forceLandscape = isPhone && isPortrait;

  return (
    <div className={['appShell', forceLandscape ? 'forceLandscape' : ''].join(' ')}>
      <div className={['container', isPhone ? 'isPhone' : ''].join(' ')}>
      <div className="topbar">
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={['btn', mode === 'keyboard' ? 'primary' : ''].join(' ')} onClick={() => setMode('keyboard')}>
            键盘
          </button>
          <button className={['btn', mode === 'receiver' ? 'primary' : ''].join(' ')} onClick={() => setMode('receiver')}>
            接收器
          </button>
          <span className="badge">WS: {wsStatus} · Clients: {clientsCount}</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
            主题：{theme === 'dark' ? '暗' : '亮'}
          </button>
          <button
            className={['btn', editMode ? 'primary' : ''].join(' ')}
            onClick={() => {
              if (editMode) {
                setSelectedKeyId(undefined);
                (document.activeElement as HTMLElement | null)?.blur?.();
              }
              setEditMode((v) => !v);
            }}
          >
            {editMode ? '退出编辑' : '编辑布局'}
          </button>
        </div>
      </div>

      {mode === 'keyboard' && (
        <div className="panel">
          <Keyboard
            layout={layout}
            editMode={editMode}
            selectedKeyId={selectedKeyId}
            onSelectKey={(id) => setSelectedKeyId(id)}
            onKeyDown={(k) => sendKey('down', k)}
            onKeyUp={(k) => sendKey('up', k)}
          />

          {editMode && (
            <div className="split" style={{ marginTop: 12 }}>
              <div className="panel">
                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>预设</div>
                    <div className="badge">适合游戏的紧凑布局</div>
                  </div>
                  <div className="row">
                    <button
                      className="btn"
                      onClick={() => {
                        setLayout(normalizeLayout(djmax8bLayout));
                        setLayoutError(null);
                        setSelectedKeyId(undefined);
                        setLayoutJsonTouched(false);
                      }}
                    >
                      DJMAX 8B
                    </button>
                  </div>
                </div>

                <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <div className="badge" style={{ alignSelf: 'center' }}>按键尺寸</div>
                  <button
                    className="btn"
                    onClick={() => {
                      const unit = typeof layout.unitPx === 'number' ? layout.unitPx : 52;
                      setLayout((l) => updateLayout(l, { unitPx: clampInt(unit - 4, 28, 120) }));
                    }}
                  >
                    -
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      const unit = typeof layout.unitPx === 'number' ? layout.unitPx : 52;
                      setLayout((l) => updateLayout(l, { unitPx: clampInt(unit + 4, 28, 120) }));
                    }}
                  >
                    +
                  </button>

                  <div className="badge" style={{ alignSelf: 'center' }}>间距</div>
                  <button
                    className="btn"
                    onClick={() => {
                      const gap = typeof layout.gapPx === 'number' ? layout.gapPx : 8;
                      setLayout((l) => updateLayout(l, { gapPx: clampInt(gap - 1, 0, 40) }));
                    }}
                  >
                    -
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      const gap = typeof layout.gapPx === 'number' ? layout.gapPx : 8;
                      setLayout((l) => updateLayout(l, { gapPx: clampInt(gap + 1, 0, 40) }));
                    }}
                  >
                    +
                  </button>
                </div>

                <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>选中按键</div>
                    <div className="badge">{selectedKey ? `${selectedKey.label} (${selectedKey.id})` : '未选择'}</div>
                  </div>
                  <button className="btn" onClick={() => setSelectedKeyId(undefined)}>
                    取消选择
                  </button>
                </div>

                <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      setLayout((l) => updateKey(l, selectedKey.id, { width: clamp(selectedKey.width - 0.5, 0.5, 8) }));
                    }}
                  >
                    宽度 -
                  </button>
                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      setLayout((l) => updateKey(l, selectedKey.id, { width: clamp(selectedKey.width + 0.5, 0.5, 8) }));
                    }}
                  >
                    宽度 +
                  </button>
                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      setLayout((l) => updateKey(l, selectedKey.id, { height: clamp(selectedKey.height - 0.25, 0.5, 3) }));
                    }}
                  >
                    高度 -
                  </button>
                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      setLayout((l) => updateKey(l, selectedKey.id, { height: clamp(selectedKey.height + 0.25, 0.5, 3) }));
                    }}
                  >
                    高度 +
                  </button>

                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      const cur = typeof selectedKey.gapBefore === 'number' ? selectedKey.gapBefore : 0;
                      setLayout((l) => updateKey(l, selectedKey.id, { gapBefore: clamp(cur - 1, 0, 20) }));
                    }}
                  >
                    空位 -
                  </button>
                  <button
                    className="btn"
                    disabled={!selectedKey}
                    onClick={() => {
                      if (!selectedKey) return;
                      const cur = typeof selectedKey.gapBefore === 'number' ? selectedKey.gapBefore : 0;
                      setLayout((l) => updateKey(l, selectedKey.id, { gapBefore: clamp(cur + 1, 0, 20) }));
                    }}
                  >
                    空位 +
                  </button>
                </div>
              </div>

              <div className="panel">
                <div style={{ fontWeight: 600, marginBottom: 8 }}>布局 JSON</div>
                <textarea
                  value={layoutJson}
                  onChange={(e) => {
                    setLayoutJsonTouched(true);
                    setLayoutJson(e.target.value);
                  }}
                />
                <div className="row" style={{ marginTop: 10, alignItems: 'center' }}>
                  <button
                    className="btn primary"
                    onClick={() => {
                      try {
                        const parsed = JSON.parse(layoutJson) as KeyboardLayout;
                        if (!parsed?.rows?.length) throw new Error('layout.rows 不能为空');
                        setLayout(normalizeLayout(parsed));
                        setLayoutJsonTouched(false);
                        setLayoutError(null);
                      } catch (e) {
                        setLayoutError(e instanceof Error ? e.message : 'JSON 解析失败');
                      }
                    }}
                  >
                    应用
                  </button>
                  <button
                    className="btn"
                    onClick={() => {
                      setLayout(normalizeLayout(djmax8bLayout));
                      setLayoutJsonTouched(false);
                      setLayoutError(null);
                    }}
                  >
                    恢复 DJMAX 8B
                  </button>
                  {layoutError && <span className="badge" style={{ color: 'salmon' }}>{layoutError}</span>}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {!isPhone && mode === 'receiver' && (
        <div className="panel">
          <div style={{ fontWeight: 600, marginBottom: 8 }}>接收器日志（最近 50 条）</div>
          <textarea readOnly value={recvLog.join('\n')} />
          <div className="row" style={{ marginTop: 10 }}>
            <button className="btn" onClick={() => setRecvLog([])}>
              清空
            </button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
