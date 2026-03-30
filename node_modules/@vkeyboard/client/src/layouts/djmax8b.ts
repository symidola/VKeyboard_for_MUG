import type { KeyboardLayout } from '@vkeyboard/shared';

// DJMAX 8B-like compact layout:
// A S D  (gap removed)  L ; '
// plus left/right Shift and L/R Alt.
export const djmax8bLayout: KeyboardLayout = {
  id: 'djmax8b',
  name: 'DJMAX 8B',
  unitPx: 72,
  gapPx: 12,
  rows: [
    {
      id: 'r1',
      keys: [
        // Big shifts to reduce touch misalignment: wrap the left/right edges
        // like an oversized Enter key.
        { id: 'k_shift_l', label: 'Shift', code: 'ShiftLeft', width: 1.35, height: 3, x: -1.35, y: 0 },
        // Keep it close to `'` but avoid overlap.
        { id: 'k_shift_r', label: 'Shift', code: 'ShiftRight', width: 1.35, height: 3, x: 6.65, y: 0 },

        { id: 'k_a', label: 'A', code: 'KeyA', width: 1, height: 2, x: 0, y: 0 },
        { id: 'k_s', label: 'S', code: 'KeyS', width: 1, height: 2, x: 1, y: 0 },
        { id: 'k_d', label: 'D', code: 'KeyD', width: 1, height: 2, x: 2, y: 0 },
        // Widen gap between D and L by shifting the right group.
        { id: 'k_l', label: 'L', code: 'KeyL', width: 1, height: 2, x: 3.6, y: 0 },
        { id: 'k_semi', label: ';', code: 'Semicolon', width: 1, height: 2, x: 4.6, y: 0 },
        { id: 'k_quote', label: "'", code: 'Quote', width: 1, height: 2, x: 5.6, y: 0 },
      ],
    },
    {
      id: 'r2',
      keys: [
        { id: 'k_alt_l', label: 'L-Alt', code: 'AltLeft', width: 3, height: 1, x: 0, y: 2 },
        { id: 'k_alt_r', label: 'R-Alt', code: 'AltRight', width: 3, height: 1, x: 3.6, y: 2 },
      ],
    },
  ],
};
