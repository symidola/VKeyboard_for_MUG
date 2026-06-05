import type { KeyboardLayout } from '@vkeyboard/shared';
import type { KeyboardMode } from '../modes/schema';
import { keyboardLayoutToMode, modeToKeyboardLayout } from '../modes/schema';

const defaultLayoutLegacy: KeyboardLayout = {
  id: 'default',
  name: 'Default',
  unitPx: 52,
  gapPx: 8,
  rows: [
    {
      id: 'r1',
      keys: [
        { id: 'k_q', label: 'Q', code: 'KeyQ', width: 1, height: 1 },
        { id: 'k_w', label: 'W', code: 'KeyW', width: 1, height: 1 },
        { id: 'k_e', label: 'E', code: 'KeyE', width: 1, height: 1 },
        { id: 'k_r', label: 'R', code: 'KeyR', width: 1, height: 1 },
        { id: 'k_t', label: 'T', code: 'KeyT', width: 1, height: 1 },
        { id: 'k_y', label: 'Y', code: 'KeyY', width: 1, height: 1 },
        { id: 'k_u', label: 'U', code: 'KeyU', width: 1, height: 1 },
        { id: 'k_i', label: 'I', code: 'KeyI', width: 1, height: 1 },
        { id: 'k_o', label: 'O', code: 'KeyO', width: 1, height: 1 },
        { id: 'k_p', label: 'P', code: 'KeyP', width: 1, height: 1 }
      ]
    },
    {
      id: 'r2',
      keys: [
        { id: 'k_a', label: 'A', code: 'KeyA', width: 1, height: 1 },
        { id: 'k_s', label: 'S', code: 'KeyS', width: 1, height: 1 },
        { id: 'k_d', label: 'D', code: 'KeyD', width: 1, height: 1 },
        { id: 'k_f', label: 'F', code: 'KeyF', width: 1, height: 1 },
        { id: 'k_g', label: 'G', code: 'KeyG', width: 1, height: 1 },
        { id: 'k_h', label: 'H', code: 'KeyH', width: 1, height: 1 },
        { id: 'k_j', label: 'J', code: 'KeyJ', width: 1, height: 1 },
        { id: 'k_k', label: 'K', code: 'KeyK', width: 1, height: 1 },
        { id: 'k_l', label: 'L', code: 'KeyL', width: 1, height: 1 }
      ]
    },
    {
      id: 'r3',
      keys: [
        { id: 'k_shift', label: 'Shift', code: 'ShiftLeft', width: 1.5, height: 1 },
        { id: 'k_z', label: 'Z', code: 'KeyZ', width: 1, height: 1 },
        { id: 'k_x', label: 'X', code: 'KeyX', width: 1, height: 1 },
        { id: 'k_c', label: 'C', code: 'KeyC', width: 1, height: 1 },
        { id: 'k_v', label: 'V', code: 'KeyV', width: 1, height: 1 },
        { id: 'k_b', label: 'B', code: 'KeyB', width: 1, height: 1 },
        { id: 'k_n', label: 'N', code: 'KeyN', width: 1, height: 1 },
        { id: 'k_m', label: 'M', code: 'KeyM', width: 1, height: 1 },
        { id: 'k_back', label: '⌫', code: 'Backspace', width: 1.5, height: 1 }
      ]
    },
    {
      id: 'r4',
      keys: [
        { id: 'k_space', label: 'Space', code: 'Space', width: 5, height: 1 },
        { id: 'k_enter', label: 'Enter', code: 'Enter', width: 2, height: 1 }
      ]
    }
  ]
};

export const defaultMode: KeyboardMode = keyboardLayoutToMode(defaultLayoutLegacy);
export const defaultLayout: KeyboardLayout = modeToKeyboardLayout(defaultMode);
