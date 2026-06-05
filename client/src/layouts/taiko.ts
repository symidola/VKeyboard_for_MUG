import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// Taiko no Tatsujin touch-drum layout.
// Two halves: left (don + ka) and right (don + ka).
// Don = inner circle, Ka = surrounding rectangular rim.
// Ka zones render first; Don circles stack on top via z-index.

export const taikoMode: KeyboardMode = {
  id: 'taiko',
  name: '太鼓',
  unitPx: 72,
  gapPx: 0,
  zones: [
    // Left Ka — full left-half rectangle (renders under Don circle)
    {
      id: 'z_ka_l',
      shape: 'rect',
      rowId: 'r1',
      x: 0, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_ka_l', label: '咔', code: 'KeyD' },
    },
    // Left Don — inner circle
    {
      id: 'z_don_l',
      shape: 'circle',
      rowId: 'r1',
      x: 1.5, y: 1.5,
      width: 5, height: 5,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    // Right Ka — full right-half rectangle
    {
      id: 'z_ka_r',
      shape: 'rect',
      rowId: 'r2',
      x: 8, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_ka_r', label: '咔', code: 'KeyK' },
    },
    // Right Don — inner circle
    {
      id: 'z_don_r',
      shape: 'circle',
      rowId: 'r2',
      x: 9.5, y: 1.5,
      width: 5, height: 5,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
