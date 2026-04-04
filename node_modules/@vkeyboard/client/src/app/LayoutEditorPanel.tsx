import React from 'react';
import type { KeyboardKey, KeyboardLayout } from '@vkeyboard/shared';
import { djmax8bLayout } from '../layouts/djmax8b';
import { clamp, clampInt, normalizeLayout, updateKey, updateLayout } from './layout-utils';

type LayoutEditorPanelProps = {
  layout: KeyboardLayout;
  setLayout: React.Dispatch<React.SetStateAction<KeyboardLayout>>;
  selectedKey?: KeyboardKey;
  clearSelectedKey: () => void;
  layoutJson: string;
  setLayoutJson: React.Dispatch<React.SetStateAction<string>>;
  setLayoutJsonTouched: React.Dispatch<React.SetStateAction<boolean>>;
  layoutError: string | null;
  setLayoutError: React.Dispatch<React.SetStateAction<string | null>>;
};

export function LayoutEditorPanel(props: LayoutEditorPanelProps): React.ReactElement {
  const {
    layout,
    setLayout,
    selectedKey,
    clearSelectedKey,
    layoutJson,
    setLayoutJson,
    setLayoutJsonTouched,
    layoutError,
    setLayoutError,
  } = props;

  const adjustSelectedKey = React.useCallback(
    (patchBuilder: (key: KeyboardKey) => Partial<KeyboardKey>) => {
      if (!selectedKey) return;
      setLayout((current) => updateKey(current, selectedKey.id, patchBuilder(selectedKey)));
    },
    [selectedKey, setLayout],
  );

  const resetToDjmax = React.useCallback(() => {
    setLayout(normalizeLayout(djmax8bLayout));
    setLayoutError(null);
    clearSelectedKey();
    setLayoutJsonTouched(false);
  }, [clearSelectedKey, setLayout, setLayoutError, setLayoutJsonTouched]);

  return (
    <div className="split" style={{ marginTop: 12 }}>
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 600 }}>预设</div>
            <div className="badge">适合游戏的紧凑布局</div>
          </div>
          <div className="row">
            <button className="btn" onClick={resetToDjmax}>
              DJMAX 8B
            </button>
          </div>
        </div>

        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <div className="badge" style={{ alignSelf: 'center' }}>
            按键尺寸
          </div>
          <button
            className="btn"
            onClick={() => {
              const unit = typeof layout.unitPx === 'number' ? layout.unitPx : 52;
              setLayout((current) => updateLayout(current, { unitPx: clampInt(unit - 4, 28, 120) }));
            }}
          >
            -
          </button>
          <button
            className="btn"
            onClick={() => {
              const unit = typeof layout.unitPx === 'number' ? layout.unitPx : 52;
              setLayout((current) => updateLayout(current, { unitPx: clampInt(unit + 4, 28, 120) }));
            }}
          >
            +
          </button>

          <div className="badge" style={{ alignSelf: 'center' }}>
            间距
          </div>
          <button
            className="btn"
            onClick={() => {
              const gap = typeof layout.gapPx === 'number' ? layout.gapPx : 8;
              setLayout((current) => updateLayout(current, { gapPx: clampInt(gap - 1, 0, 40) }));
            }}
          >
            -
          </button>
          <button
            className="btn"
            onClick={() => {
              const gap = typeof layout.gapPx === 'number' ? layout.gapPx : 8;
              setLayout((current) => updateLayout(current, { gapPx: clampInt(gap + 1, 0, 40) }));
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
          <button className="btn" onClick={clearSelectedKey}>
            取消选择
          </button>
        </div>

        <div className="row" style={{ marginTop: 10, flexWrap: 'wrap' }}>
          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => ({ width: clamp(key.width - 0.5, 0.5, 8) }));
            }}
          >
            宽度 -
          </button>
          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => ({ width: clamp(key.width + 0.5, 0.5, 8) }));
            }}
          >
            宽度 +
          </button>
          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => ({ height: clamp(key.height - 0.25, 0.5, 3) }));
            }}
          >
            高度 -
          </button>
          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => ({ height: clamp(key.height + 0.25, 0.5, 3) }));
            }}
          >
            高度 +
          </button>

          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => {
                const cur = typeof key.gapBefore === 'number' ? key.gapBefore : 0;
                return { gapBefore: clamp(cur - 1, 0, 20) };
              });
            }}
          >
            空位 -
          </button>
          <button
            className="btn"
            disabled={!selectedKey}
            onClick={() => {
              adjustSelectedKey((key) => {
                const cur = typeof key.gapBefore === 'number' ? key.gapBefore : 0;
                return { gapBefore: clamp(cur + 1, 0, 20) };
              });
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
          <button className="btn" onClick={resetToDjmax}>
            恢复 DJMAX 8B
          </button>
          {layoutError && (
            <span className="badge" style={{ color: 'salmon' }}>
              {layoutError}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
