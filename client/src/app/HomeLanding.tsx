import React from 'react';

type HomeLandingProps = {
  wsStatus: string;
  clientsCount: number;
  currentModeLabel: string;
  onEnterKeyboard: () => void;
  onEnterEditor: () => void;
  onOpenInfo: () => void;
};

export function HomeLanding(props: HomeLandingProps): React.ReactElement {
  const { wsStatus, clientsCount, currentModeLabel, onEnterKeyboard, onEnterEditor, onOpenInfo } = props;

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
          面向节奏游戏的可扩展触控键盘。当前已接入 DJMAX，后续将扩展四键、七键与太鼓分区模式。
        </p>
        <div className="homeMetaRow">
          <span className="badge">WS: {wsStatus}</span>
          <span className="badge">Clients: {clientsCount}</span>
          <span className="badge">当前模式: {currentModeLabel}</span>
        </div>
      </div>

      <div className="homeEntryGrid">
        <button className="homeEntry homeEntryPrimary" onClick={onEnterKeyboard}>
          <h3>键盘</h3>
          <p>进入演奏键盘视图，直接测试按键链路和触控反馈。</p>
          <span>立即进入</span>
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
