import { ThemeConfig } from '@/types'

// 默认鱼缸主题
export const fishTankTheme: ThemeConfig = {
  theme_id: 'fish_tank_01',
  theme_name: '深海鱼缸',
  assets: {
    background_url: '/backgrounds/fish-tank.svg',
    particle_effect: 'bubbles',
  },
  palette: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7'],
  ai_settings: {
    keywords: ['fish', 'whale', 'shark', 'octopus', 'jellyfish', 'crab'],
    prompt_style: 'children\'s drawing, scribble, thick marker lines, wobbly lines, MS paint style, no shading, flat color',
  },
  game_rules: {
    spawn_rate: 5,
    max_imposters: 5,
  },
}

// 咖啡厅主题
export const cafeTheme: ThemeConfig = {
  theme_id: 'cafe_01',
  theme_name: '混乱咖啡厅',
  assets: {
    background_url: '/backgrounds/cafe.svg',
    particle_effect: 'steam',
  },
  palette: ['#6F4E37', '#FFFFFF', '#000000', '#D4A574', '#8B4513'],
  ai_settings: {
    keywords: ['coffee cup', 'croissant', 'donut', 'spoon', 'cake'],
    prompt_style: 'drawn on a napkin, messy ink, children\'s drawing, wobbly lines',
  },
  game_rules: {
    spawn_rate: 5,
    max_imposters: 5,
  },
}

// 所有主题
export const themes: Record<string, ThemeConfig> = {
  fish_tank_01: fishTankTheme,
  cafe_01: cafeTheme,
}

export const getTheme = (themeId: string): ThemeConfig => {
  return themes[themeId] || fishTankTheme
}
