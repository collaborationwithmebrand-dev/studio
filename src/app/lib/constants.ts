export type FestivalTheme = 'Normal' | 'Diwali' | 'Holi' | 'Eid' | 'Rakhi' | 'Christmas';

export interface ThemeConfig {
  bg: string;
  nav: string;
  title: string;
  accent: string;
  effects: FestivalTheme;
  gradient: string;
  cardBg: string;
}

export const THEME_DATA: Record<FestivalTheme, ThemeConfig> = {
  Normal: {
    bg: 'bg-[#fafafa]',
    nav: 'bg-white/80',
    title: 'BOUNSI BAZAAR',
    accent: 'text-green-600',
    effects: 'Normal',
    gradient: 'from-green-600 via-emerald-600 to-teal-700',
    cardBg: 'bg-white'
  },
  Diwali: {
    bg: 'bg-[#0a0a0a]',
    nav: 'bg-[#1a1400]/90',
    title: '🪔 BOUNSI DIWALI 🪔',
    accent: 'text-yellow-500',
    effects: 'Diwali',
    gradient: 'from-orange-500 via-red-600 to-yellow-400',
    cardBg: 'bg-[#151000]'
  },
  Holi: {
    bg: 'bg-[#fff5f8]',
    nav: 'bg-white/90',
    title: '🎨 BOUNSI HOLI 🎨',
    accent: 'text-pink-600',
    effects: 'Holi',
    gradient: 'from-yellow-400 via-pink-500 to-purple-600',
    cardBg: 'bg-white'
  },
  Eid: {
    bg: 'bg-[#001a12]',
    nav: 'bg-[#002b1c]/90',
    title: '🌙 BOUNSI EID 🌙',
    accent: 'text-emerald-400',
    effects: 'Eid',
    gradient: 'from-emerald-500 via-green-600 to-emerald-900',
    cardBg: 'bg-[#002418]'
  },
  Rakhi: {
    bg: 'bg-[#fff0f3]',
    nav: 'bg-white/90',
    title: '🎀 BOUNSI RAKHI 🎀',
    accent: 'text-rose-600',
    effects: 'Rakhi',
    gradient: 'from-rose-500 via-pink-600 to-rose-700',
    cardBg: 'bg-white'
  },
  Christmas: {
    bg: 'bg-[#f0f9ff]',
    nav: 'bg-white/90',
    title: '🎄 BOUNSI XMAS 🎄',
    accent: 'text-red-600',
    effects: 'Christmas',
    gradient: 'from-red-600 via-sky-600 to-green-700',
    cardBg: 'bg-white'
  }
};