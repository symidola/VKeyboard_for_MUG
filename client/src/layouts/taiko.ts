import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// Taiko no Tatsujin touch-drum — single drum face.
// One circle (the drum) centred in the middle, split vertically by semiX.
// Both Don keys share the same bounding box; right-Don renders on top.
// elementFromPoint is skipped for semiX keys — detection falls through
// to coordinate-based logic which picks the correct half.

export const taikoMode: KeyboardMode = {
  id: 'taiko',
  name: '太鼓',
  unitPx: 60,
  gapPx: 0,
  zones: [
    // Left Ka — left-half backdrop
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
    // Left Don — left semicircle of the drum (underneath)
    {
      id: 'z_don_l',
      shape: 'circle',
      semiX: 'left',
      rowId: 'r2',
      x: 4, y: 0.5,
      width: 8, height: 8,
      binding: { keyId: 'k_don_l', label: '咚', code: 'KeyF' },
    },
    // Right Don — right semicircle (same box, renders on top)
    {
      id: 'z_don_r',
      shape: 'circle',
      semiX: 'right',
      rowId: 'r2',
      x: 4, y: 0.5,
      width: 8, height: 8,
      binding: { keyId: 'k_don_r', label: '咚', code: 'KeyJ' },
    },
  ],
};

export const taikoLayout = modeToKeyboardLayout(taikoMode);
