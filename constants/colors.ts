/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    text: '#162126',
    tint: '#167D72',
    background: '#F1F4F3',
    foreground: '#162126',
    card: '#FFFFFF',
    cardForeground: '#162126',
    primary: '#167D72',
    primaryForeground: '#FFFFFF',
    secondary: '#E6ECEA',
    secondaryForeground: '#263B3A',
    muted: '#E7ECEA',
    mutedForeground: '#697875',
    accent: '#F2E8D1',
    accentForeground: '#684D1B',
    destructive: '#C74646',
    destructiveForeground: '#FFFFFF',
    border: '#DCE4E1',
    input: '#DCE4E1',
    success: '#16866F',
    warning: '#BD8429',
    remoteSurface: '#E8EEEC',
  },
  dark: {
    text: '#F4F7F5',
    tint: '#70D0BE',
    background: '#0C1115',
    foreground: '#F4F7F5',
    card: '#151D22',
    cardForeground: '#F4F7F5',
    primary: '#70D0BE',
    primaryForeground: '#10211F',
    secondary: '#202B31',
    secondaryForeground: '#D7E5E0',
    muted: '#1B252A',
    mutedForeground: '#9AA9A5',
    accent: '#3A3020',
    accentForeground: '#F2C774',
    destructive: '#E06B68',
    destructiveForeground: '#2A1111',
    border: '#2A373B',
    input: '#2A373B',
    success: '#70D0BE',
    warning: '#E5B451',
    remoteSurface: '#10171B',
  },
  radius: 18,
};

export default colors;
