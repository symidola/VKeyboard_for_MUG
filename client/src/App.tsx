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
import { skinOptions, type SkinId } from './app/skins';

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
  const [skin, setSkin] = React.useState<SkinId>(initialStorage.skin);
  const [layout, setLayout] = React.useState(initialLayout);
  const [layoutJson, setLayoutJson] = React.useState(() => JSON.stringify(initialLayout, null, 2));
  const [layoutJsonTouched, setLayoutJsonTouched] = React.useState(false);
  const [layoutError, setLayoutError] = React.useState<string | null>(null);

  const { wsStatus, clientsCount, recvLog, clearRecvLog, sendKey } = useKeyboardSocket({ mode, layout });

  React.useEffect(() => {
    if (!isPhone) return;
    if (mode !== 'keyboard') setMode('keyboard');
    if (selectedKeyId) setSelectedKeyId(undefined);
  }, [isPhone, mode, selectedKeyId]);

  React.useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.dataset.skin = skin;
    saveStorage({ theme, layout, modeId: gameModeId, skin });
  }, [gameModeId, theme, layout, skin]);

  React.useEffect(() => {
    if (!layoutJsonTouched) {
      setLayoutJson(JSON.stringify(layout, null, 2));
    }
  }, [layout, layoutJsonTouched]);

  const clearSelectedKey = React.useCallback(() => {
    setSelectedKeyId(undefined);
  }, []);

  const enterKeyboard = React.useCallback(() => {
    setView('workspace');
    setMode('keyboard');
    setEditMode(false);
    clearSelectedKey();
  }, [clearSelectedKey]);

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
  }, []);

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

  const selectSkin = React.useCallback((nextSkin: SkinId) => {
    setSkin(nextSkin);
  }, []);

  const selectedKey = React.useMemo(() => {
    if (!selectedKeyId) return undefined;
    return layout.rows.flatMap((r) => r.keys).find((k) => k.id === selectedKeyId);
  }, [layout, selectedKeyId]);

  const currentGameModeLabel = React.useMemo(() => {
    const hit = gameModeOptions.find((it) => it.id === gameModeId);
    return hit?.label ?? gameModeId;
  }, [gameModeId]);

  const modeSwitcher = (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
      {gameModeOptions.map((opt) => (
        <button
          key={opt.id}
          className={['btn', gameModeId === opt.id ? 'primary' : ''].join(' ')}
          onClick={() => selectGameMode(opt.id)}
          title={opt.implemented ? undefined : '已预留，待实现'}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );

  const forceLandscape = isPhone && isPortrait;
  const workspaceBackdrop = (
    <div className="homeBackdrop" aria-hidden="true">
      <span className="homeGlow homeGlowA" />
      <span className="homeGlow homeGlowB" />
      <span className="homeGlow homeGlowC" />
    </div>
  );

  return (
    <div className={['appShell', forceLandscape ? 'forceLandscape' : ''].join(' ')}>
      <div className={['container', isPhone ? 'isPhone' : ''].join(' ')}>
        {view === 'home' && (
          <HomeLanding
            wsStatus={wsStatus}
            clientsCount={clientsCount}
            currentModeLabel={currentGameModeLabel}
            gameModeId={gameModeId}
            gameModeOptions={gameModeOptions}
            skin={skin}
            skinOptions={skinOptions}
            onSelectGameMode={selectGameMode}
            onSelectSkin={selectSkin}
            onEnterKeyboard={enterKeyboard}
            onEnterEditor={enterEditor}
            onOpenInfo={openInfo}
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
                <button className="btn" onClick={backHome}>首页</button>
                {modeSwitcher}
              </div>
              <span className="badge">
                WS: {wsStatus} · Clients: {clientsCount}
              </span>
            </div>

            {mode === 'keyboard' && (
              <div className="workspacePanel">
                {workspaceBackdrop}
                <Keyboard
                  layout={layout}
                  editMode={editMode}
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
                {workspaceBackdrop}
                <div style={{ fontWeight: 600, marginBottom: 8 }}>接收器日志（最近 50 条）</div>
                <textarea readOnly value={recvLog.join('\n')} />
                <div className="row" style={{ marginTop: 10 }}>
                  <button className="btn" onClick={clearRecvLog}>清空</button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
