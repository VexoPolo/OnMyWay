// Design tokens — mirrors the landing page / handoff §3. Do not invent new hues.
export const colors = {
  ground: '#0A0A0A',
  surface: '#171717',
  line: '#232326',
  brandA: '#FCD34D',
  brandB: '#F59E0B',
  onBrand: '#1F1300', // the ONLY text colour on yellow
  brandDark: '#FBBF24', // yellow as text on dark
  brandLight: '#A16207', // yellow as text on light
  light: '#F1F1F1',
  muted: '#737373',
  ink: '#F4F4F5',
  warning: '#EA580C',
  error: '#EF4444',
  pinPickup: '#8B5CF6',
  pinDrop: '#EF4444',
} as const;

export const brandGradient = [colors.brandA, colors.brandB] as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 6, md: 12, lg: 16, button: 12, card: 14 } as const;

export const fonts = {
  display: 'Archivo_800ExtraBold',
  displayBlack: 'Archivo_900Black',
  body: 'IBMPlexSans_400Regular',
  bodyMedium: 'IBMPlexSans_500Medium',
  bodySemi: 'IBMPlexSans_600SemiBold',
  mono: 'IBMPlexMono_400Regular',
  monoMedium: 'IBMPlexMono_500Medium',
} as const;

export const type = {
  headingLarge: 32,
  title: 24,
  subtitle: 18,
  body: 16,
  caption: 12,
} as const;
