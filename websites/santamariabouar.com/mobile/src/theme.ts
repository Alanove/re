import { MD3LightTheme, type MD3Theme } from 'react-native-paper';

/** Santa Maria Bouar website palette (public/css/variables.scss). */
export const brand = {
  primary: '#C87E2F',
  accent: '#B8621B',
  beige: '#E5D4C1',
  goldenBrown: '#6B3410',
  darkText: '#4A3728',
  lightText: '#8B7355',
  cream: '#F9F5F0',
  border: '#E8DED3',
  white: '#FFFFFF',
  primarySoft: '#F6EADB',
  danger: '#B33A3A'
};

export const fontFamilies = {
  regular: 'Roboto_400Regular',
  medium: 'Roboto_500Medium',
  bold: 'Roboto_700Bold'
};

const base = MD3LightTheme.fonts;
const bold = { fontFamily: fontFamilies.bold, fontWeight: '700' as const };
const medium = { fontFamily: fontFamilies.medium, fontWeight: '500' as const };
const regular = { fontFamily: fontFamilies.regular, fontWeight: '400' as const };

const fonts: MD3Theme['fonts'] = {
  ...base,
  displayLarge: { ...base.displayLarge, ...bold },
  displayMedium: { ...base.displayMedium, ...bold },
  displaySmall: { ...base.displaySmall, ...bold },
  headlineLarge: { ...base.headlineLarge, ...bold },
  headlineMedium: { ...base.headlineMedium, ...bold },
  headlineSmall: { ...base.headlineSmall, ...bold },
  titleLarge: { ...base.titleLarge, ...bold },
  titleMedium: { ...base.titleMedium, ...bold },
  titleSmall: { ...base.titleSmall, ...bold },
  labelLarge: { ...base.labelLarge, ...medium },
  labelMedium: { ...base.labelMedium, ...medium },
  labelSmall: { ...base.labelSmall, ...medium },
  bodyLarge: { ...base.bodyLarge, ...regular },
  bodyMedium: { ...base.bodyMedium, ...regular },
  bodySmall: { ...base.bodySmall, ...regular },
  default: { ...base.default, ...regular }
};

export const theme: MD3Theme = {
  ...MD3LightTheme,
  roundness: 4,
  fonts,
  colors: {
    ...MD3LightTheme.colors,
    primary: brand.primary,
    onPrimary: brand.white,
    primaryContainer: brand.primarySoft,
    onPrimaryContainer: brand.accent,
    secondary: brand.goldenBrown,
    onSecondary: brand.white,
    secondaryContainer: brand.beige,
    onSecondaryContainer: brand.darkText,
    tertiary: brand.accent,
    onTertiary: brand.white,
    tertiaryContainer: brand.primarySoft,
    onTertiaryContainer: brand.accent,
    background: brand.cream,
    onBackground: brand.darkText,
    surface: brand.white,
    onSurface: brand.darkText,
    surfaceVariant: brand.cream,
    onSurfaceVariant: brand.lightText,
    surfaceDisabled: 'rgba(74, 55, 40, 0.12)',
    onSurfaceDisabled: 'rgba(74, 55, 40, 0.38)',
    outline: brand.border,
    outlineVariant: brand.border,
    error: brand.danger,
    errorContainer: '#FDECEA',
    onErrorContainer: '#8A1F1F',
    inverseSurface: brand.darkText,
    inverseOnSurface: brand.cream,
    inversePrimary: brand.beige,
    backdrop: 'rgba(74, 55, 40, 0.45)',
    elevation: {
      level0: 'transparent',
      level1: brand.white,
      level2: brand.white,
      level3: brand.white,
      level4: brand.white,
      level5: brand.white
    }
  }
};

/** Badge colours used on the website for invoice status. */
export const statusPalette = {
  unpaid: { background: '#FDECEA', text: '#8A1F1F' },
  partial: { background: '#FFF4E0', text: '#8A5A12' },
  paid: { background: '#E8F6EC', text: '#1F6B3A' }
};

export const statusColors = {
  paid: '#1F6B3A',
  partial: '#8A5A12',
  unpaid: '#8A1F1F',
  income: '#1F6B3A',
  expense: '#B33A3A'
};

export const alertPalette = {
  error: { background: '#FDECEA', text: '#8A1F1F', icon: 'alert-circle-outline' },
  success: { background: '#E8F6EC', text: '#1F6B3A', icon: 'check-circle-outline' },
  info: { background: brand.beige, text: brand.darkText, icon: 'information-outline' }
} as const;

export const cardStyle = {
  backgroundColor: brand.white,
  borderColor: brand.border,
  borderWidth: 1,
  borderRadius: 12,
  shadowColor: brand.darkText,
  shadowOpacity: 0.05,
  shadowRadius: 8,
  shadowOffset: { width: 0, height: 4 },
  elevation: 0
};
