export type ThemePreset = 'light' | 'dark';

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
    preview: ['#F3F4F6', '#FFFFFF', '#315B8C'],
  },
  {
    id: 'dark',
    name: 'Dark',
    description: 'Kontras nyaman untuk fokus malam hari.',
    isDark: true,
    preview: ['#121A28', '#1A2434', '#8FB4DC'],
  },
];

export function getThemePreset(theme: ThemePreset) {
  return themePresets.find((preset) => preset.id === theme) || themePresets[0];
}

export function applyThemePreset(theme: ThemePreset) {
  const root = document.documentElement;
  const preset = getThemePreset(theme);

  root.dataset.theme = theme;

  // index.html memasang class "light" sejak awal; tanpa menanggalkannya,
  // root berakhir dengan "light dark" sekaligus setelah tombol tema ditekan.
  root.classList.toggle('dark', preset.isDark);
  root.classList.toggle('light', !preset.isDark);
}
