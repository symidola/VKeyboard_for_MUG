import type { KeyboardLayout } from '@vkeyboard/shared';
import { djmax8bMode } from '../layouts/djmax8b';
import { taikoMode } from '../layouts/taiko';
import { modeToKeyboardLayout } from './schema';

export type GameModeId = 'fourkey' | 'sevenkey' | 'djmax' | 'taiko';

export type GameModeOption = {
  id: GameModeId;
  label: string;
  implemented: boolean;
};

export const gameModeOptions: GameModeOption[] = [
  { id: 'fourkey',  label: '四键模式',   implemented: false },
  { id: 'sevenkey', label: '七键模式',   implemented: false },
  { id: 'djmax',    label: 'DJMAX模式',  implemented: true },
  { id: 'taiko',    label: '太鼓模式',   implemented: true },
];

export function isGameModeId(value: string): value is GameModeId {
  return gameModeOptions.some((it) => it.id === value);
}

export function getDefaultGameModeId(): GameModeId {
  return 'djmax';
}

export function isImplementedGameMode(modeId: GameModeId): boolean {
  return gameModeOptions.some((it) => it.id === modeId && it.implemented);
}

export function getLayoutForGameMode(modeId: GameModeId): KeyboardLayout | null {
  if (modeId === 'djmax') {
    return modeToKeyboardLayout(djmax8bMode);
  }
  if (modeId === 'taiko') {
    return modeToKeyboardLayout(taikoMode);
  }
  return null;
}
