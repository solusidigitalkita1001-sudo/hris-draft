export type ThemePreset =
  | 'light'
  | 'dark'
  | 'ocean'
  | 'forest'
  | 'sunset'
  | 'midnight';

export interface ThemePresetOption {
  id: ThemePreset;
  name: string;
  description: string;
  isDark: boolean;
  preview: [string, string, string];
}

export const themePresets: ThemePresetOption[] = [
  {
    id: 'light',
    name: 'Light',
    description: 'Bersih dan netral untuk kerja harian.',
    isDark: false,
    preview: ['#ffffff', '#eff6ff', '#2563eb'],
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Kontras nyaman untuk fokus malam hari.',
    isDark: true,
    preview: ['#111827', '#1f2937', '#f97316'],
  },
  {
    id: 'ocean',
    name: 'Ocean',
    description: 'Nuansa biru lembut dan modern.',
    isDark: false,
    preview: ['#f8fbff', '#dbeafe', '#0284c7'],
  },
  {
    id: 'forest',
    name: 'Forest',
    description: 'Hijau tenang untuk nuansa natural.',
    isDark: false,
    preview: ['#f7fcf9', '#dcfce7', '#059669'],
  },
  {
    id: 'sunset',
    name: 'Sunset',
    description: 'Gelap hangat dengan aksen amber.',
    isDark: true,
    preview: ['#1c1917', '#292524', '#f59e0b'],
  },
  {
    id: 'midnight',
    name: 'Midnight',
    description: 'Gelap dingin dengan aksen violet.',
    isDark: true,
    preview: ['#0f172a', '#1e1b4b', '#8b5cf6'],
  },
];

export function getThemePreset(theme: ThemePreset) {
  return themePresets.find((preset) => preset.id === theme) || themePresets[0];
}

export function applyThemePreset(theme: ThemePreset) {
  const root = document.documentElement;
  const preset = getThemePreset(theme);

  root.dataset.theme = theme;

  if (preset.isDark) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
}
