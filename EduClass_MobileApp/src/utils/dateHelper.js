import dayjs from 'dayjs';
import 'dayjs/locale/id';

// Aturan waktu EduClass:
// - Timestamp dari database (deadline, created_at, ...) disimpan dalam UTC (ISO string).
//   dayjs(iso) otomatis mengubahnya ke waktu lokal HP saat ditampilkan.
// - Jam pelajaran ('07:30:00', tipe time) adalah jam dinding lokal, BUKAN UTC.
// Locale 'id' dipasang per pemanggilan agar tidak mengubah locale global milik layar lain.
// Parameter `now` bisa diisi untuk pengujian; defaultnya waktu sekarang.

const local = (value) => dayjs(value).locale('id');

// Chip tenggat tugas -> { label, tone, icon }
// Hari ini / terlambat -> 'danger', besok -> 'warning', lainnya -> 'neutral'.
export function formatDeadline(dueAt, now = dayjs()) {
  if (!dueAt) return { label: 'Tanpa tenggat', tone: 'neutral', icon: 'calendar-outline' };
  const due = local(dueAt);
  const jam = due.format('HH.mm');
  if (due.isSame(now, 'day')) return { label: `Hari ini, ${jam}`, tone: 'danger', icon: 'timer-outline' };
  if (due.isSame(now.add(1, 'day'), 'day')) return { label: `Besok, ${jam}`, tone: 'warning', icon: 'time-outline' };
  if (due.isBefore(now)) return { label: `Terlambat, ${due.format('D MMM')}`, tone: 'danger', icon: 'alert-circle-outline' };
  return { label: due.format('ddd, D MMM, HH.mm'), tone: 'neutral', icon: 'calendar-outline' };
}

// Tenggat belum lewat dan paling lambat akhir hari besok
export function isDueSoon(dueAt, now = dayjs()) {
  if (!dueAt) return false;
  const due = dayjs(dueAt);
  return due.isAfter(now) && !due.isAfter(now.add(1, 'day').endOf('day'));
}

// Minggu berjalan, Senin sampai Minggu (locale 'id' memulai minggu di hari Senin)
export function isThisWeek(date, now = dayjs()) {
  if (!date) return false;
  const d = dayjs(date);
  const week = now.locale('id');
  return !d.isBefore(week.startOf('week')) && !d.isAfter(week.endOf('week'));
}

// '07:30:00' -> dayjs hari ini pukul 07.30 waktu lokal
export function jamHariIni(jam, now = dayjs()) {
  const [h = 0, m = 0, s = 0] = String(jam ?? '').split(':').map(Number);
  return now.hour(h).minute(m).second(s).millisecond(0);
}

// Status jadwal hari ini: 'upcoming' (belum mulai) | 'active' (berlangsung) | 'done' (selesai)
export function getScheduleStatus(jamMulai, jamSelesai, now = dayjs()) {
  if (now.isBefore(jamHariIni(jamMulai, now))) return 'upcoming';
  if (now.isBefore(jamHariIni(jamSelesai, now))) return 'active';
  return 'done';
}

// 35 -> '35 menit', 65 -> '1 jam 5 menit', 120 -> '2 jam'
function formatDurasi(menit) {
  const total = Math.max(0, Math.ceil(menit));
  const jam = Math.floor(total / 60);
  const sisa = total % 60;
  if (!jam) return `${sisa} menit`;
  return sisa ? `${jam} jam ${sisa} menit` : `${jam} jam`;
}

// Untuk sesi yang sedang berlangsung, contoh "Sisa 35 menit"
export function formatSisaWaktu(jamSelesai, now = dayjs()) {
  return `Sisa ${formatDurasi(jamHariIni(jamSelesai, now).diff(now, 'minute', true))}`;
}

// Untuk sesi mendatang, contoh "Mulai 45 menit lagi"
export function formatMulaiDalam(jamMulai, now = dayjs()) {
  return `Mulai ${formatDurasi(jamHariIni(jamMulai, now).diff(now, 'minute', true))} lagi`;
}

// '07:30:00' -> '07.30'
export function formatJam(jam) {
  return jam ? String(jam).slice(0, 5).replace(':', '.') : '';
}

// Chip tanggal di Beranda, contoh "Senin, 28 Okt"
export function formatTodayChip(now = dayjs()) {
  return local(now).format('dddd, D MMM');
}

// Tanggal lengkap, contoh "Senin, 26 Oktober 2026"
export function formatTanggalPanjang(now = dayjs()) {
  return local(now).format('dddd, D MMMM YYYY');
}

// Nama hari seperti di kolom hari pada tabel jadwal, contoh 'Senin'
export function namaHariIni(now = dayjs()) {
  return local(now).format('dddd');
}
