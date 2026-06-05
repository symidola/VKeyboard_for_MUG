import type { KeyboardKey, KeyboardLayout, KeyboardRow } from '@vkeyboard/shared';

export type ModeZoneShape = 'rect' | 'circle';

export type ModeZoneBinding = {
  keyId: string;
  label: string;
  code?: string;
};

export type ModeZone = {
  id: string;
  shape: ModeZoneShape;
  rowId?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  gapBefore?: number;
  semiX?: 'left' | 'right';
  binding: ModeZoneBinding;
};

export type KeyboardMode = {
  id: string;
  name: string;
  unitPx?: number;
  gapPx?: number;
  zones: ModeZone[];
};

function toKeyboardKey(zone: ModeZone): KeyboardKey {
  return {
    id: zone.binding.keyId,
    label: zone.binding.label,
    code: zone.binding.code,
    width: zone.width,
    height: zone.height,
    x: zone.x,
    y: zone.y,
    gapBefore: zone.gapBefore,
    shape: zone.shape === 'circle' ? 'circle' : undefined,
    semiX: zone.semiX,
  };
}

export function modeToKeyboardLayout(mode: KeyboardMode): KeyboardLayout {
  const rowMap = new Map<string, KeyboardKey[]>();

  const ordered = mode.zones.slice().sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    return a.x - b.x;
  });

  for (const zone of ordered) {
    const rowId = zone.rowId ?? `r_${Math.floor(zone.y)}`;
    if (!rowMap.has(rowId)) rowMap.set(rowId, []);
    rowMap.get(rowId)!.push(toKeyboardKey(zone));
  }

  const rows: KeyboardRow[] = Array.from(rowMap.entries()).map(([id, keys]) => ({ id, keys }));

  return {
    id: mode.id,
    name: mode.name,
    unitPx: mode.unitPx,
    gapPx: mode.gapPx,
    rows,
  };
}

export function keyboardLayoutToMode(layout: KeyboardLayout): KeyboardMode {
  const zones: ModeZone[] = [];

  layout.rows.forEach((row, rowIndex) => {
    let flowX = 0;
    row.keys.forEach((key) => {
      const hasAbsX = typeof key.x === 'number';
      const hasAbsY = typeof key.y === 'number';
      const gapBefore = typeof key.gapBefore === 'number' ? key.gapBefore : 0;

      if (!hasAbsX) {
        flowX += gapBefore;
      }

      const x = hasAbsX ? (key.x as number) : flowX;
      const y = hasAbsY ? (key.y as number) : rowIndex;

      zones.push({
        id: key.id,
        shape: key.shape === 'circle' ? 'circle' : 'rect',
        rowId: row.id,
        x,
        y,
        width: key.width,
        height: key.height,
        gapBefore: key.gapBefore,
        semiX: key.semiX,
        binding: {
          keyId: key.id,
          label: key.label,
          code: key.code,
        },
      });

      if (!hasAbsX) {
        flowX = x + key.width;
      }
    });
  });

  return {
    id: layout.id,
    name: layout.name,
    unitPx: layout.unitPx,
    gapPx: layout.gapPx,
    zones,
  };
}
