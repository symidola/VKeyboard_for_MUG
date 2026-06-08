import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// Two circles exactly filling their 8×8 halves — Don covers the
// full width and height. Only the four rounded corners are Ka.

export const taikoMode: KeyboardMode = {
  id: 'taiko',
  name: '太鼓',
  unitPx: 64,
  gapPx: 0,
  zones: [
    {
      id: 'z_ka_l',
      shape: 'rect',
      rowId: 'r1',
      x: 0, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_ka_l', label: '咔', code: 'KeyD' },
    },
    {
      id: 'z_ka_r',
      shape: 'rect',
      rowId: 'r1',
      x: 8, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_ka_r', label: '咔', code: 'KeyK' },
    },
    {
      id: 'z_don_l',
      shape: 'circle',
      semiX: 'left',
      rowId: 'r2',
      x: 0, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    {
      id: 'z_don_r',
      shape: 'circle',
      semiX: 'right',
      rowId: 'r2',
      x: 8, y: 0,
      width: 8, height: 8,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
