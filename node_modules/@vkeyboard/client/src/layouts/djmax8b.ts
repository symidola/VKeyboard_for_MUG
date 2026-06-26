import type { KeyboardMode } from '../modes/schema';
import { modeToKeyboardLayout } from '../modes/schema';

// DJMAX 8B-like compact layout:
// A S D  (gap removed)  L ; '
// plus left/right Shift and L/R Alt.
export const djmax8bMode: KeyboardMode = {
  id: 'djmax8b',
  name: 'DJMAX 8B',
  unitPx: 72,
  gapPx: 12,
  zones: [
    // Big shifts to reduce touch misalignment: wrap the left/right edges
    // like an oversized Enter key.
    {
      id: 'z_shift_l',
      shape: 'rect',
      rowId: 'r1',
      x: -1.35,
      y: 0,
      width: 1.35,
      height: 3,
      binding: { keyId: 'k_shift_l', label: 'Shift', code: 'ShiftLeft' },
    },
    {
      id: 'z_shift_r',
      shape: 'rect',
      rowId: 'r1',
      x: 6.65,
      y: 0,
      width: 1.35,
      height: 3,
      binding: { keyId: 'k_shift_r', label: 'Shift', code: 'ShiftRight' },
    },
    { id: 'z_a', shape: 'rect', rowId: 'r1', x: 0, y: 0, width: 1, height: 2, binding: { keyId: 'k_a', label: 'A', code: 'KeyA' } },
    { id: 'z_s', shape: 'rect', rowId: 'r1', x: 1, y: 0, width: 1, height: 2, binding: { keyId: 'k_s', label: 'S', code: 'KeyS' } },
    { id: 'z_d', shape: 'rect', rowId: 'r1', x: 2, y: 0, width: 1, height: 2, binding: { keyId: 'k_d', label: 'D', code: 'KeyD' } },
    // Widen gap between D and L by shifting the right group.
    { id: 'z_l', shape: 'rect', rowId: 'r1', x: 3.6, y: 0, width: 1, height: 2, binding: { keyId: 'k_l', label: 'L', code: 'KeyL' } },
    {
      id: 'z_semi',
      shape: 'rect',
      rowId: 'r1',
      x: 4.6,
      y: 0,
      width: 1,
      height: 2,
      binding: { keyId: 'k_semi', label: ';', code: 'Semicolon' },
    },
    {
      id: 'z_quote',
      shape: 'rect',
      rowId: 'r1',
      x: 5.6,
      y: 0,
      width: 1,
      height: 2,
      binding: { keyId: 'k_quote', label: "'", code: 'Quote' },
    },
    {
      id: 'z_alt_l',
      shape: 'rect',
      rowId: 'r2',
      x: 0,
      y: 2,
      width: 3,
      height: 1,
      binding: { keyId: 'k_alt_l', label: 'L-Alt', code: 'AltLeft' },
    },
    {
      id: 'z_alt_r',
      shape: 'rect',
      rowId: 'r2',
      x: 3.6,
      y: 2,
      width: 3,
      height: 1,
      binding: { keyId: 'k_alt_r', label: 'R-Alt', code: 'AltRight' },
    },
  ],
};

// Backward-compatible export for existing rendering/input pipeline.
export const djmax8bLayout = modeToKeyboardLayout(djmax8bMode);
