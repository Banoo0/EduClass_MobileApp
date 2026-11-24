export const colors = {
  bg: '#0E1015',
  card: '#171A21',
  cardAlt: '#1D212A',
  border: '#272C37',
  text: '#F1F3F7',
  textMuted: '#9AA3B2',
  textFaint: '#667085',
  primary: '#3B82F6',
  primarySoft: 'rgba(59,130,246,0.14)',
  success: '#16A34A',
  danger: '#F87171',
  dangerSoft: 'rgba(248,113,113,0.12)',
  siswa: '#F4A3A3', // warna avatar siswa di mockup
  guru: '#9DBDFF', // warna avatar guru di mockup
  warning: '#F59E0B', // tenggat "Besok"
  warningSoft: 'rgba(245,158,11,0.14)',
  successSoft: 'rgba(22,163,74,0.16)',
  accentText: '#A7C5FF', statusGreen: '#36D6A0', statusOrange: '#FFB65C', statusRed: '#FFB4B4', statusYellow: '#FACC15', avatarInk: '#0E1015',
  navSurface: '#20252E', navActive: '#304561', navActiveText: '#C1D7FF', chatMine: '#244c83', chatTime: '#b9c8dc',
  onAccent: '#FFFFFF', // teks/ikon di atas tombol berwarna
};

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };
export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 };

// xs untuk chip/badge, md untuk teks isi, lg judul kartu, xl judul bagian, xxl sapaan, display angka besar
export const fontSize = { xs: 12, sm: 13, md: 15, lg: 17, xl: 20, xxl: 24, display: 30 };
export const fontWeight = { regular: '400', medium: '500', semibold: '600', bold: '700', heavy: '800' };

export default { colors, radius, spacing, fontSize, fontWeight };
export const lightColors = {
  ...colors,
  accentText: '#245FC5', statusGreen: '#167447', statusOrange: '#925606', statusRed: '#B42336', statusYellow: '#925606',
  navSurface: '#FFFFFF', navActive: '#E0EBFF', navActiveText: '#194DAD', chatMine: '#DCE9FF', chatTime: '#50617A',
  bg: '#EDF3FA', card: '#FFFFFF', cardAlt: '#F0F4FA', border: '#CFD9E7',
  text: '#142238', textMuted: '#47586E', textFaint: '#65758A',
  primary: '#245FC5', primarySoft: '#E3EDFF', success: '#167447', successSoft: '#DDF4E7',
  danger: '#B42336', dangerSoft: '#FCE6E9', warning: '#925606', warningSoft: '#FFF0D6',
};
