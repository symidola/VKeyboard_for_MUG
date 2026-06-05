import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// Taiko no Tatsujin touch-drum layout.
// One drum face split vertically into left/right semicircles (Don).
// Left  half → Don circle on rect Ka base
// Right half → Don circle on rect Ka base
// Don circles stack on top of Ka rects via z-index; tap inside circle = Don, outside = Ka.

export const taikoMode: KeyboardMode = {
  id: 'taiko',
  name: '太鼓',
  unitPx: 64,
  gapPx: 0,
  zones: [
    // Left Ka — full left-half backdrop
    {
      id: 'z_ka_l',
      shape: 'rect',
      rowId: 'r1',
      x: 0, y: 0,
      width: 8, height: 9,
      binding: { keyId: 'k_ka_l', label: '咔', code: 'KeyD' },
    },
    // Left Don — large semicircle filling the left half
    {
      id: 'z_don_l',
      shape: 'circle',
      rowId: 'r1',
      x: 0.25, y: 0.75,
      width: 7.5, height: 7.5,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    // Right Ka — full right-half backdrop
    {
      id: 'z_ka_r',
      shape: 'rect',
      rowId: 'r2',
      x: 8, y: 0,
      width: 8, height: 9,
      binding: { keyId: 'k_ka_r', label: '咔', code: 'KeyK' },
    },
    // Right Don — large semicircle filling the right half
    {
      id: 'z_don_r',
      shape: 'circle',
      rowId: 'r2',
      x: 8.25, y: 0.75,
      width: 7.5, height: 7.5,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
