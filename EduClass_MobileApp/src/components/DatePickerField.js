import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../context/ThemeContext';
import { radius, spacing, fontSize, fontWeight } from '../core/theme';

export default function DatePickerField({ label = 'Tanggal', value, onChange, required = false }) {
  const { colors } = useAppTheme();
  const styles = makeStyles(colors);
  const [visible, setVisible] = useState(false);
  const formatted = value && /^\d{4}-\d{2}-\d{2}$/.test(value)
    ? new Date(`${value}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    : 'Pilih tanggal';

  return <View style={styles.wrapper}>
    <Text style={styles.label}>{label}{required ? ' *' : ''}</Text>
    <Pressable accessibilityRole="button" onPress={() => setVisible(true)} style={styles.field}>
      <Ionicons name="calendar-outline" size={19} color={colors.primary} />
      <Text style={[styles.value, !value && styles.placeholder]}>{formatted}</Text>
      <Ionicons name="chevron-down" size={17} color={colors.textMuted} />
    </Pressable>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={() => setVisible(false)}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setVisible(false)} accessibilityLabel="Tutup kalender" />
        <View style={styles.dialog}>
          <View style={styles.header}>
            <Text style={styles.title}>Pilih {label.toLowerCase()}</Text>
            <Pressable onPress={() => setVisible(false)} hitSlop={10} accessibilityLabel="Tutup kalender"><Ionicons name="close" size={22} color={colors.textMuted} /></Pressable>
          </View>
          <Calendar
            current={value || undefined}
            onDayPress={(day) => { onChange(day.dateString); setVisible(false); }}
            markedDates={value ? { [value]: { selected: true, selectedColor: colors.primary } } : {}}
            enableSwipeMonths
            theme={{
              backgroundColor: colors.card,
              calendarBackground: colors.card,
              textSectionTitleColor: colors.textMuted,
              dayTextColor: colors.text,
              monthTextColor: colors.text,
              arrowColor: colors.primary,
              todayTextColor: colors.primary,
              textDisabledColor: colors.textFaint,
              textDayFontWeight: '500',
              textMonthFontWeight: '700',
              textDayHeaderFontWeight: '600',
            }}
          />
        </View>
      </View>
    </Modal>
  </View>;
}

const makeStyles = (colors) => StyleSheet.create({
  wrapper: { gap: spacing.xs },
  label: { color: colors.textMuted, fontSize: fontSize.sm, fontWeight: fontWeight.semibold },
  field: { minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, backgroundColor: colors.input || colors.card },
  value: { flex: 1, color: colors.text, fontSize: fontSize.md },
  placeholder: { color: colors.textMuted },
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: spacing.md, backgroundColor: 'rgba(0,0,0,0.65)' },
  dialog: { width: '100%', maxWidth: 380, padding: spacing.md, borderRadius: radius.lg, backgroundColor: colors.card, elevation: 12 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  title: { color: colors.text, fontSize: fontSize.lg, fontWeight: fontWeight.bold },
});
