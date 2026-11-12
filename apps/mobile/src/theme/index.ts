export const colors = {
  background: '#F5F6F8',
  surface: '#FFFFFF',
  border: '#E1E4EA',
  text: '#14171F',
  textMuted: '#5C6370',
  primary: '#0B5FFF',
  primaryText: '#FFFFFF',
  credit: '#0F8A4B',
  debit: '#C2342B',
  danger: '#C2342B',
  dangerBackground: '#FDECEA',
  disabled: '#A9B0BC',
} as const;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;

export const radius = { sm: 6, md: 10, lg: 14 } as const;

export const typography = {
  title: { fontSize: 24, fontWeight: '700' },
  heading: { fontSize: 18, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 14, fontWeight: '500' },
  caption: { fontSize: 12, fontWeight: '400' },
  amountLarge: { fontSize: 32, fontWeight: '700', fontVariant: ['tabular-nums'] },
} as const;
