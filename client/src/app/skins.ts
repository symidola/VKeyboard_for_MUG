export type SkinId = 'default' | 'retro';

export type SkinOption = {
  id: SkinId;
  label: string;
  description: string;
};

export const skinOptions: SkinOption[] = [
  { id: 'default', label: '默认', description: '现代暗色主题' },
  { id: 'retro', label: '8-bit 像素', description: '复古像素字体与霓虹按键特效' },
];

export function isSkinId(value: string): value is SkinId {
  return skinOptions.some((s) => s.id === value);
}

export function getSkinLabel(id: SkinId): string {
  return skinOptions.find((s) => s.id === id)?.label ?? id;
}
