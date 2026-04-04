import type { KeyboardKey } from '@vkeyboard/shared';

export type AbsBounds = {
  minX: number;
  minY: number;
  width: number;
  height: number;
  pad: number;
};

export type AbsKeyRect = {
  key: KeyboardKey;
  left: number;
  top: number;
  width: number;
  height: number;
};
