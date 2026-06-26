import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// One circular drum face split vertically into left/right semicircles.
// Both Don keys share the same bounding box (the full circle).
// semiX restricts hit to the correct half.
// Ka = everything outside the circle, split left/right.

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
      width: 8, height: 10,
      binding: { keyId: 'k_ka_l', label: '咔', code: 'KeyD' },
    },
    {
      id: 'z_ka_r',
      shape: 'rect',
      rowId: 'r1',
      x: 8, y: 0,
      width: 8, height: 10,
      binding: { keyId: 'k_ka_r', label: '咔', code: 'KeyK' },
    },
    {
      id: 'z_don_l',
      shape: 'circle',
      semiX: 'left',
      rowId: 'r2',
      x: 3.5, y: 0.5,
      width: 9, height: 9,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    {
      id: 'z_don_r',
      shape: 'circle',
      semiX: 'right',
      rowId: 'r2',
      x: 3.5, y: 0.5,
      width: 9, height: 9,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
