import { useId } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { colors, fontSize, fontWeight } from '../core/theme';

// Lingkaran progres. progress bernilai 0-1 (di luar rentang otomatis dipotong).
// Isi colorEnd untuk gradien, misal color={colors.success} colorEnd={colors.primary} seperti mockup.
export default function ProgressRing({
  progress = 0,
  size = 120,
  strokeWidth = 10,
  label,
  sublabel,
  color = colors.primary,
  colorEnd,
  trackColor = colors.border,
}) {
  // id SVG harus unik per ring dan aman dipakai di url(#...)
  const gradientId = 'ring' + useId().replace(/[^a-zA-Z0-9_-]/g, '');
  const value = Math.min(Math.max(Number(progress) || 0, 0), 1);
  const center = size / 2;
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;

  return (
    <View
      style={{ width: size, height: size }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
    >
      <Svg width={size} height={size}>
        {colorEnd ? (
          <Defs>
            <LinearGradient id={gradientId} x1="1" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={color} />
              <Stop offset="1" stopColor={colorEnd} />
            </LinearGradient>
          </Defs>
        ) : null}
        <Circle cx={center} cy={center} r={r} stroke={trackColor} strokeWidth={strokeWidth} fill="none" />
        {/* Tanpa progres, jangan gambar apa pun (strokeLinecap round akan menyisakan titik) */}
        {value > 0 ? (
          <Circle
            cx={center}
            cy={center}
            r={r}
            stroke={colorEnd ? `url(#${gradientId})` : color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - value)}
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        {label ? <Text style={styles.label}>{label}</Text> : null}
        {sublabel ? <Text style={styles.sublabel}>{sublabel}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { color: colors.text, fontSize: fontSize.xl, fontWeight: fontWeight.heavy },
  sublabel: { color: colors.textMuted, fontSize: fontSize.xs, marginTop: 2 },
});
