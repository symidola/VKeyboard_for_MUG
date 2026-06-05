import React from 'react';
import type { ClientRole } from '@vkeyboard/shared';
import { Keyboard } from './Keyboard';
import { HomeLanding } from './app/HomeLanding';
import { InfoPage } from './app/InfoPage';
import { LayoutEditorPanel } from './app/LayoutEditorPanel';
import { loadStorage, normalizeLayout, saveStorage, type ThemeMode } from './app/layout-utils';
import { gameModeOptions, getLayoutForGameMode, type GameModeId } from './modes/presets';
import { useKeyboardSocket } from './app/useKeyboardSocket';
import { useViewportMode } from './app/useViewportMode';
import { type IosFixMode, readIosFixMode } from './keyboard/iosTouchFixes';

type ShellView = 'home' | 'workspace' | 'info';

export function App(): React.ReactElement {
  const { isPhone, isPortrait } = useViewportMode();

  const initialStorage = React.useMemo(() => loadStorage(), []);
  const initialLayout = React.useMemo(() => normalizeLayout(initialStorage.layout), [initialStorage]);

  const [mode, setMode] = React.useState<ClientRole>('keyboard');
  const [view, setView] = React.useState<ShellView>('home');
  const [gameModeId, setGameModeId] = React.useState<GameModeId>(initialStorage.modeId);
  const [editMode, setEditMode] = React.useState(false);
  const [selectedKeyId, setSelectedKeyId] = React.useState<string | undefined>(undefined);

  const [theme, setTheme] = React.useState<ThemeMode>(initialStorage.theme);
  const [layout, setLayout] = React.useState(initialLayout);
  const [layoutJson, setLayoutJson] = React.useState(() => JSON.stringify(initialLayout, null, 2));
  const [layoutJsonTouched, setLayoutJsonTouched] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);
  const [oLatch, setOLatch] = React.useState(false);
  const [iosFixMode, setIosFixMode] = React.useState<IosFixMode>(readIosFixMode);

  const { wsStatus, clientsCount, recvLog, clearRecvLog, sendKey } = useKeyboardSocket({ mode, layout });

  React.useEffect(() => {
    // Phone mode always stays in keyboard role to avoid receiver mis-touch.
    if (!isPhone) return;
    if (mode !== 'keyboard') setMode('keyboard');
    if (selectedKeyId) setSelectedKeyId(undefined);
  }, [isPhone, mode, selectedKeyId]);

  React.useEffect(() => {
    document.body.dataset.theme = theme;
    saveStorage({ theme, layout, modeId: gameModeId });
  }, [gameModeId, theme, layout]);

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

  const enterKeyboard = React.useCallback(() => {
    setView('workspace');
    setMode('keyboard');
    setEditMode(false);
    clearSelectedKey();
  }, [clearSelectedKey]);

  const enterKeyboardWithFix = React.useCallback(
    (mode: IosFixMode) => {
      setIosFixMode(mode);
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('iosFix', mode);
        window.history.replaceState(null, '', url.toString());
      } catch { /* */ }
      enterKeyboard();
    },
    [enterKeyboard],
  );

  const enterEditor = React.useCallback(() => {
    setView('workspace');
    setMode('keyboard');
    setEditMode(true);
    clearSelectedKey();
  }, [clearSelectedKey]);

  const openInfo = React.useCallback(() => {
    setView('info');
  }, []);

  const backHome = React.useCallback(() => {
    setView('home');
    setMode('keyboard');
    if (oLatch) setOLatch(false);
  }, [oLatch]);

  const selectGameMode = React.useCallback(
    (nextModeId: GameModeId) => {
      setGameModeId(nextModeId);
      const modeLayout = getLayoutForGameMode(nextModeId);
      if (modeLayout) {
        setLayout(normalizeLayout(modeLayout));
      }
      clearSelectedKey();
    },
    [clearSelectedKey],
  );

  const selectedKey = React.useMemo(() => {
    if (!selectedKeyId) return undefined;
    return layout.rows.flatMap((r) => r.keys).find((k) => k.id === selectedKeyId);
  }, [layout, selectedKeyId]);

  const currentGameModeLabel = React.useMemo(() => {
    const hit = gameModeOptions.find((it) => it.id === gameModeId);
    return hit?.label ?? gameModeId;
  }, [gameModeId]);

  const modeSwitcher = (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
      {gameModeOptions.map((opt) => (
        <button
          key={opt.id}
          className={['btn', gameModeId === opt.id ? 'primary' : ''].join(' ')}
          onClick={() => selectGameMode(opt.id)}
          title={opt.implemented ? '已接入' : '状态已预留，具体布局待实现'}
        >
          {opt.label}
          {!opt.implemented ? '（预留）' : ''}
        </button>
      ))}
    </div>
  );

  const forceLandscape = isPhone && isPortrait;

  return (
    <div className={['appShell', forceLandscape ? 'forceLandscape' : ''].join(' ')}>
      <div className={['container', isPhone ? 'isPhone' : ''].join(' ')}>
        {view === 'home' && (
          <HomeLanding
            wsStatus={wsStatus}
            clientsCount={clientsCount}
            currentModeLabel={currentGameModeLabel}
            onEnterKeyboard={enterKeyboard}
            onEnterEditor={enterEditor}
            onOpenInfo={openInfo}
            onEnterKeyboardWithFix={enterKeyboardWithFix}
          />
        )}

        {view === 'info' && (
          <InfoPage
            onBackHome={backHome}
            onEnterKeyboard={enterKeyboard}
          />
        )}

        {view === 'workspace' && (
          <>
            <div className="topbar">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn" onClick={backHome}>
                  首页
                </button>
                <button className="btn" onClick={openInfo}>
                  信息页
                </button>
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
              {modeSwitcher}
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
                {isPhone && (
                  <div className="row" style={{ marginBottom: 10, flexWrap: 'wrap' }}>
                    <button className="btn" onClick={backHome}>
                      首页
                    </button>
                    <button className="btn" onClick={openInfo}>
                      信息页
                    </button>
                    <button className="btn" onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}>
                      主题：{theme === 'dark' ? '暗' : '亮'}
                    </button>
                    <button className={['btn', editMode ? 'primary' : ''].join(' ')} onClick={() => setEditMode((v) => !v)}>
                      {editMode ? '退出编辑' : '编辑布局'}
                    </button>
                  </div>
                )}
                {isPhone && (
                  <div style={{ marginBottom: 10 }}>
                    {modeSwitcher}
                  </div>
                )}
                <Keyboard
                  layout={layout}
                  editMode={editMode}
                  forceAlwaysTouch={oLatch}
                  iosFixMode={iosFixMode}
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
          </>
        )}
      </div>
    </div>
  );
}
