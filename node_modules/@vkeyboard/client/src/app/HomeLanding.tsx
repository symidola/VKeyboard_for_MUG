import React from 'react';
import { type GameModeId, type GameModeOption } from '../modes/presets';
import { type SkinId, type SkinOption, getSkinLabel } from './skins';

type HomeLandingProps = {
  wsStatus: string;
  clientsCount: number;
  currentModeLabel: string;
  gameModeId: GameModeId;
  gameModeOptions: GameModeOption[];
  skin: SkinId;
  skinOptions: SkinOption[];
  onSelectGameMode: (id: GameModeId) => void;
  onSelectSkin: (id: SkinId) => void;
  onEnterKeyboard: () => void;
  onEnterEditor: () => void;
  onOpenInfo: () => void;
};

export function HomeLanding(props: HomeLandingProps): React.ReactElement {
  const {
    wsStatus,
    clientsCount,
    gameModeId,
    gameModeOptions,
    skin,
    skinOptions,
    onSelectGameMode,
    onSelectSkin,
    onEnterKeyboard,
    onEnterEditor,
    onOpenInfo,
  } = props;

  return (
    <section className="homeStage panel">
      <div className="homeBackdrop" aria-hidden="true">
        <span className="homeGlow homeGlowA" />
        <span className="homeGlow homeGlowB" />
        <span className="homeGlow homeGlowC" />
      </div>

      <div className="homeHero">
        <div className="homeKicker">VKeyboard for MUG</div>
        <h1>多游戏触控键盘工作台</h1>
        <p>
          面向节奏游戏的可扩展触控键盘。在下方选择游戏模式与视觉皮肤后进入演奏。
        </p>
        <div className="homeMetaRow">
          <span className="badge">WS: {wsStatus}</span>
          <span className="badge">Clients: {clientsCount}</span>
        </div>
      </div>

      <div className="panel" style={{ marginTop: 16 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>游戏模式</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {gameModeOptions.map((opt) => (
            <button
              key={opt.id}
              className={['btn', gameModeId === opt.id ? 'primary' : ''].join(' ')}
              onClick={() => onSelectGameMode(opt.id)}
              disabled={!opt.implemented}
              title={opt.implemented ? undefined : '暂未实现'}
            >
              {opt.label}
              {!opt.implemented ? '（预留）' : ''}
            </button>
          ))}
        </div>
      </div>

      <div className="panel" style={{ marginTop: 12 }}>
        <h3 style={{ margin: '0 0 8px 0' }}>皮肤</h3>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {skinOptions.map((opt) => (
            <button
              key={opt.id}
              className={['btn', skin === opt.id ? 'primary' : ''].join(' ')}
              onClick={() => onSelectSkin(opt.id)}
              title={opt.description}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="homeEntryGrid">
        <button className="homeEntry homeEntryPrimary" onClick={onEnterKeyboard}>
          <h3>键盘</h3>
          <p>进入演奏键盘视图，直接测试按键链路和触控反馈。</p>
          <span>立即进入 {getSkinLabel(skin)} · {gameModeOptions.find((o) => o.id === gameModeId)?.label ?? ''}</span>
        </button>

        <button className="homeEntry" onClick={onEnterEditor}>
          <h3>个性化编辑器</h3>
          <p>进入布局编辑工作台，调整按键尺寸、位置与映射参数。</p>
          <span>开始编辑</span>
        </button>

        <button className="homeEntry" onClick={onOpenInfo}>
          <h3>信息页</h3>
          <p>查看项目状态、模式规划与下一阶段开发方向。</p>
          <span>查看详情</span>
        </button>
      </div>
    </section>
  );
}
