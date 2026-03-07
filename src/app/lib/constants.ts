export type FestivalTheme = 'Normal' | 'Diwali' | 'Holi' | 'Eid' | 'Rakhi' | 'Christmas';

export interface ThemeConfig {
  bg: string;
  nav: string;
  title: string;
  accent: string;
  effects: FestivalTheme;
  gradient: string;
}

export const THEME_DATA: Record<FestivalTheme, ThemeConfig> = {
  Normal: {
    bg: 'bg-white',
    nav: 'bg-white',
    title: 'BOUNSI BAZAAR',
    accent: 'text-green-600',
    effects: 'Normal',
    gradient: 'from-green-600 to-green-700'
  },
  Diwali: {
    bg: 'bg-[#1a0f00]',
    nav: 'bg-[#2a1700]',
    title: '🪔 SHUBH DIWALI 🪔',
    accent: 'text-yellow-500',
    effects: 'Diwali',
    gradient: 'from-orange-600 via-red-600 to-yellow-500'
  },
  Holi: {
    bg: 'bg-pink-50',
    nav: 'bg-white',
    title: '🎨 HAPPY HOLI 🎨',
    accent: 'text-pink-600',
    effects: 'Holi',
    gradient: 'from-yellow-400 via-red-500 to-pink-500'
  },
  Eid: {
    bg: 'bg-[#002b1c]',
    nav: 'bg-[#003d27]',
    title: '🌙 EID MUBARAK 🌙',
    accent: 'text-emerald-400',
    effects: 'Eid',
    gradient: 'from-emerald-700 to-green-900'
  },
  Rakhi: {
    bg: 'bg-rose-50',
    nav: 'bg-white',
    title: '🎀 RAKSHA BANDHAN 🎀',
    accent: 'text-rose-600',
    effects: 'Rakhi',
    gradient: 'from-rose-500 to-pink-700'
  },
  Christmas: {
    bg: 'bg-sky-50',
    nav: 'bg-white',
    title: '🎄 MERRY CHRISTMAS 🎄',
    accent: 'text-red-600',
    effects: 'Christmas',
    gradient: 'from-red-600 to-green-700'
  }
};
