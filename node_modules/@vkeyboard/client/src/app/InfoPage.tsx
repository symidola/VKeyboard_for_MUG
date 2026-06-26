import React from 'react';

type InfoPageProps = {
  onBackHome: () => void;
  onEnterKeyboard: () => void;
};

export function InfoPage(props: InfoPageProps): React.ReactElement {
  const { onBackHome, onEnterKeyboard } = props;

  return (
    <section className="panel infoPage">
      <div className="infoPageHead">
        <div>
          <div className="homeKicker">Information</div>
          <h2>项目信息页</h2>
        </div>
        <div className="row" style={{ flexWrap: 'wrap' }}>
          <button className="btn" onClick={onBackHome}>
            返回首页
          </button>
          <button className="btn primary" onClick={onEnterKeyboard}>
            进入键盘
          </button>
        </div>
      </div>

      <div className="infoCardGrid">
        <article className="infoCard">
          <h3>当前能力</h3>
          <p>已支持触控输入、WS 链路、布局编辑与模式切换状态预留。</p>
        </article>

        <article className="infoCard">
          <h3>模式规划</h3>
          <p>四键模式、七键模式、DJMAX 模式、太鼓模式将统一收敛到同一 Mode Schema。</p>
        </article>

        <article className="infoCard">
          <h3>编辑器方向</h3>
          <p>后续将加入图形化按键编辑，支持形状、大小、映射与预设导入导出。</p>
        </article>
      </div>
    </section>
  );
}
