export type SkinId = 'default' | 'retro' | 'cyber' | 'ocean' | 'candy' | 'forest' | 'midnight' | 'bone';

export type SkinOption = {
  id: SkinId;
  label: string;
  description: string;
};

export const skinOptions: SkinOption[] = [
  { id: 'default',   label: '默认',     description: '现代暗色主题' },
  { id: 'retro',     label: '8-bit 像素', description: '复古像素字体与霓虹按键特效' },
  { id: 'cyber',     label: '赛博朋克',   description: '霓虹粉青、故障美学与高对比度科幻感' },
  { id: 'ocean',     label: '深海',       description: '蓝色渐变与荧光青，沉浸式水下氛围' },
  { id: 'candy',     label: '糖果',       description: '粉紫渐变、圆润柔和的女团风' },
  { id: 'forest',    label: '森林',       description: '暗绿基底搭配鲜亮叶绿高亮，自然静谧感' },
  { id: 'midnight',  label: '午夜',       description: '深紫底色与琥珀金点缀，奢华而克制' },
  { id: 'bone',      label: '骨瓷',       description: '暖灰与米白交织，低对比度的温润质感' },
];

export function isSkinId(value: string): value is SkinId {
  return skinOptions.some((s) => s.id === value);
}

export function getSkinLabel(id: SkinId): string {
  return skinOptions.find((s) => s.id === id)?.label ?? id;
}
