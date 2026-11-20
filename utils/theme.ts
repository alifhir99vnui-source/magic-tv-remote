export type Language = 'ar' | 'en';
export type AppearanceMode = 'system' | 'dark' | 'light';

export type AccentId =
  | 'neonBlue'
  | 'iceCyan'
  | 'emerald'
  | 'royalPurple'
  | 'fieryOrange'
  | 'rubyRed'
  | 'luxuryGold'
  | 'neonPink'
  | 'turquoise'
  | 'titanium';

export interface AccentTheme {
  id: AccentId;
  name: { ar: string; en: string };
  value: string;
}

export const ACCENT_THEMES: AccentTheme[] = [
  { id: 'neonBlue', name: { ar: 'أزرق نيون', en: 'Neon Blue' }, value: '#3B9BFF' },
  { id: 'iceCyan', name: { ar: 'سمائي ثلجي', en: 'Ice Cyan' }, value: '#67E8F9' },
  { id: 'emerald', name: { ar: 'أخضر زمردي', en: 'Emerald Green' }, value: '#10B981' },
  { id: 'royalPurple', name: { ar: 'بنفسجي ملكي', en: 'Royal Purple' }, value: '#8B5CF6' },
  { id: 'fieryOrange', name: { ar: 'برتقالي ناري', en: 'Fiery Orange' }, value: '#F97316' },
  { id: 'rubyRed', name: { ar: 'أحمر ياقوتي', en: 'Ruby Red' }, value: '#E11D48' },
  { id: 'luxuryGold', name: { ar: 'ذهبي فخم', en: 'Luxury Gold' }, value: '#D4AF37' },
  { id: 'neonPink', name: { ar: 'وردي نيون', en: 'Neon Pink' }, value: '#EC4899' },
  { id: 'turquoise', name: { ar: 'فيروزي', en: 'Turquoise' }, value: '#14B8A6' },
  { id: 'titanium', name: { ar: 'فضي تيتانيوم', en: 'Titanium Silver' }, value: '#B8C4CE' },
];

export function getAccent(id: AccentId): AccentTheme {
  return ACCENT_THEMES.find((theme) => theme.id === id) ?? ACCENT_THEMES[0];
}
