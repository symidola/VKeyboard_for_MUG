import type { KeyboardKey } from '@vkeyboard/shared';

export const KEY_SELECTOR = 'button.key[data-keyid]';

// 固定锚点键：用于 always-touch 模式下维持触摸路径稳定。
export const ANCHOR_O_KEY: KeyboardKey = {
  id: '__anchor_o__',
  label: 'O',
  code: 'KeyO',
  width: 1,
  height: 1,
};
