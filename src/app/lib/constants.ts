export type FestivalTheme = 'Normal' | 'Diwali' | 'Holi' | 'Eid' | 'Rakhi' | 'Christmas';

export interface ThemeConfig {
  bg: string;
  nav: string;
  title: string;
  accent: string;
  effects: FestivalTheme;
}

export const THEME_DATA: Record<FestivalTheme, ThemeConfig> = {
  Normal: {
    bg: 'bg-slate-50',
    nav: 'bg-primary',
    title: 'BOUNSI BAZAAR',
    accent: 'text-primary',
    effects: 'Normal'
  },
  Diwali: {
    bg: 'bg-amber-50',
    nav: 'bg-red-800',
    title: '🪔 SHUBH DIWALI 🪔',
    accent: 'text-orange-600',
    effects: 'Diwali'
  },
  Holi: {
    bg: 'bg-pink-50',
    nav: 'bg-gradient-to-r from-yellow-400 via-red-500 to-pink-500',
    title: '🎨 HOLI UTSAV 🎨',
    accent: 'text-pink-600',
    effects: 'Holi'
  },
  Eid: {
    bg: 'bg-green-50',
    nav: 'bg-emerald-900',
    title: '🌙 EID MUBARAK 🌙',
    accent: 'text-emerald-700',
    effects: 'Eid'
  },
  Rakhi: {
    bg: 'bg-rose-50',
    nav: 'bg-rose-600',
    title: '🎀 RAKSHA BANDHAN 🎀',
    accent: 'text-rose-600',
    effects: 'Rakhi'
  },
  Christmas: {
    bg: 'bg-blue-50',
    nav: 'bg-red-700',
    title: '🎄 MERRY CHRISTMAS 🎄',
    accent: 'text-red-600',
    effects: 'Christmas'
  }
};
