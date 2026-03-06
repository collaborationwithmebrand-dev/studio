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
    bg: 'bg-slate-50',
    nav: 'bg-primary/90',
    title: 'BOUNSI BAZAAR',
    accent: 'text-primary',
    effects: 'Normal',
    gradient: 'from-blue-600 to-indigo-700'
  },
  Diwali: {
    bg: 'bg-[#1a0f00]',
    nav: 'bg-[#4a0e0e]/90',
    title: '🪔 SHUBH DIWALI 🪔',
    accent: 'text-yellow-500',
    effects: 'Diwali',
    gradient: 'from-orange-600 via-red-600 to-yellow-500'
  },
  Holi: {
    bg: 'bg-orange-50',
    nav: 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500',
    title: '🎨 HOLI UTSAV 🎨',
    accent: 'text-pink-600',
    effects: 'Holi',
    gradient: 'from-yellow-400 via-red-500 to-pink-500'
  },
  Eid: {
    bg: 'bg-[#002b1c]',
    nav: 'bg-[#004d33]/90',
    title: '🌙 EID MUBARAK 🌙',
    accent: 'text-emerald-400',
    effects: 'Eid',
    gradient: 'from-emerald-700 to-green-900'
  },
  Rakhi: {
    bg: 'bg-rose-50',
    nav: 'bg-rose-600/90',
    title: '🎀 RAKSHA BANDHAN 🎀',
    accent: 'text-rose-600',
    effects: 'Rakhi',
    gradient: 'from-rose-500 to-pink-700'
  },
  Christmas: {
    bg: 'bg-sky-50',
    nav: 'bg-red-700/90',
    title: '🎄 MERRY CHRISTMAS 🎄',
    accent: 'text-red-600',
    effects: 'Christmas',
    gradient: 'from-red-600 to-green-700'
  }
};