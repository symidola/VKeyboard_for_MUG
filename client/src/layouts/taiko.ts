import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// Two semicircles filling their respective halves — left Don covers
// the full left half as a circle, right Don the full right half.
// They touch at the centre line x=8.  The four corners of each half
// are Ka (the rim).  Both Don circles render on top of Ka rects.

export const taikoMode: KeyboardMode = {
  id: 'taiko',
  name: '太鼓',
  unitPx: 60,
  gapPx: 0,
  zones: [
    // Left Ka — left-half backdrop (renders under the Don circle)
    {
      id: 'z_ka_l',
      shape: 'rect',
      rowId: 'r1',
      x: 0, y: 0,
      width: 8, height: 9,
      binding: { keyId: 'k_ka_l', label: '咔', code: 'KeyD' },
    },
    // Right Ka — right-half backdrop
    {
      id: 'z_ka_r',
      shape: 'rect',
      rowId: 'r1',
      x: 8, y: 0,
      width: 8, height: 9,
      binding: { keyId: 'k_ka_r', label: '咔', code: 'KeyK' },
    },
    // Left Don — fills left half (radius 4, centre x=4 y=4.5)
    {
      id: 'z_don_l',
      shape: 'circle',
      semiX: 'left',
      rowId: 'r2',
      x: 0, y: 0.5,
      width: 8, height: 8,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    // Right Don — fills right half (radius 4, centre x=12 y=4.5)
    {
      id: 'z_don_r',
      shape: 'circle',
      semiX: 'right',
      rowId: 'r2',
      x: 8, y: 0.5,
      width: 8, height: 8,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
