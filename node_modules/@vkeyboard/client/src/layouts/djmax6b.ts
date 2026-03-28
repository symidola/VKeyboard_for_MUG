import type { KeyboardLayout } from '@vkeyboard/shared';

// DJMAX 6B-like compact layout:
// A S D  (gap removed)  L ; '
// plus left/right Shift as requested.
export const djmax6bLayout: KeyboardLayout = {
  id: 'djmax6b',
  name: 'DJMAX 6B',
  unitPx: 72,
  gapPx: 12,
  rows: [
    {
      id: 'r1',
      keys: [
        // Big shifts to reduce touch misalignment: wrap the left/right edges
        // like an oversized Enter key.
        { id: 'k_shift_l', label: 'Shift', code: 'ShiftLeft', width: 1.35, height: 2, x: -1.35, y: 0 },
        // Keep it close to `'` but avoid overlap.
        { id: 'k_shift_r', label: 'Shift', code: 'ShiftRight', width: 1.35, height: 2, x: 6.65, y: 0 },

        { id: 'k_a', label: 'A', code: 'KeyA', width: 1, height: 1.5, x: 0, y: 0 },
        { id: 'k_s', label: 'S', code: 'KeyS', width: 1, height: 1.5, x: 1, y: 0 },
        { id: 'k_d', label: 'D', code: 'KeyD', width: 1, height: 1.5, x: 2, y: 0 },
        // Widen gap between D and L by shifting the right group.
        { id: 'k_l', label: 'L', code: 'KeyL', width: 1, height: 1.5, x: 3.60, y: 0 },
        { id: 'k_semi', label: ';', code: 'Semicolon', width: 1, height: 1.5, x: 4.60, y: 0 },
        { id: 'k_quote', label: "'", code: 'Quote', width: 1, height: 1.5, x: 5.60, y: 0 }
      ]
    }
  ]
};
