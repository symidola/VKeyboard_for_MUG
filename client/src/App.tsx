import React from 'react';
import type { ClientRole } from '@vkeyboard/shared';
import { Keyboard } from './Keyboard';
import { LayoutEditorPanel } from './app/LayoutEditorPanel';
import { loadStorage, normalizeLayout, saveStorage, type ThemeMode } from './app/layout-utils';
import { useKeyboardSocket } from './app/useKeyboardSocket';
import { useViewportMode } from './app/useViewportMode';

export function App(): React.ReactElement {
  const { isPhone, isPortrait } = useViewportMode();

  const initialStorage = React.useMemo(() => loadStorage(), []);
  const initialLayout = React.useMemo(() => normalizeLayout(initialStorage.layout), [initialStorage]);

  const [mode, setMode] = React.useState<ClientRole>('keyboard');
  const [editMode, setEditMode] = React.useState(false);
  const [selectedKeyId, setSelectedKeyId] = React.useState<string | undefined>(undefined);

  const [theme, setTheme] = React.useState<ThemeMode>(initialStorage.theme);
  const [layout, setLayout] = React.useState(initialLayout);
  const [layoutJson, setLayoutJson] = React.useState(() => JSON.stringify(initialLayout, null, 2));
  const [layoutJsonTouched, setLayoutJsonTouched] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);
  const [oLatch, setOLatch] = React.useState(false);

  const { wsStatus, clientsCount, recvLog, clearRecvLog, sendKey } = useKeyboardSocket({ mode, layout });

  React.useEffect(() => {
    // Phone mode always stays in keyboard view to avoid editing/receiver mis-touch.
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

  React.useEffect(() => {
    if (mode === 'keyboard') return;
    if (oLatch) setOLatch(false);
  }, [mode, oLatch]);

  const toggleConsoleO = React.useCallback(() => {
    setOLatch((v) => !v);
  }, []);

  const clearSelectedKey = React.useCallback(() => {
    setSelectedKeyId(undefined);
  }, []);

  const selectedKey = React.useMemo(() => {
    if (!selectedKeyId) return undefined;
    return layout.rows.flatMap((r) => r.keys).find((k) => k.id === selectedKeyId);
  }, [layout, selectedKeyId]);

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
            <span className="badge">
              WS: {wsStatus} · Clients: {clientsCount}
            </span>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className={['btn', oLatch ? 'primary' : ''].join(' ')} onClick={toggleConsoleO}>
              O键锁定/锚点：{oLatch ? '开启' : '关闭'}
            </button>
            <button className="btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
              主题：{theme === 'dark' ? '暗' : '亮'}
            </button>
            <button
              className={['btn', editMode ? 'primary' : ''].join(' ')}
              onClick={() => {
                if (editMode) {
                  clearSelectedKey();
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
              forceAlwaysTouch={oLatch}
              selectedKeyId={selectedKeyId}
              onSelectKey={(id) => setSelectedKeyId(id)}
              onKeyDown={(k) => sendKey('down', k)}
              onKeyUp={(k) => sendKey('up', k)}
            />

            {editMode && (
              <LayoutEditorPanel
                layout={layout}
                setLayout={setLayout}
                selectedKey={selectedKey}
                clearSelectedKey={clearSelectedKey}
                layoutJson={layoutJson}
                setLayoutJson={setLayoutJson}
                setLayoutJsonTouched={setLayoutJsonTouched}
                layoutError={layoutError}
                setLayoutError={setLayoutError}
              />
            )}
          </div>
        )}

        {!isPhone && mode === 'receiver' && (
          <div className="panel">
            <div style={{ fontWeight: 600, marginBottom: 8 }}>接收器日志（最近 50 条）</div>
            <textarea readOnly value={recvLog.join('\n')} />
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn" onClick={clearRecvLog}>
                清空
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
