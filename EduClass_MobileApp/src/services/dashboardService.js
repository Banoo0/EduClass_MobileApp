import dayjs from 'dayjs';
import { namaHariIni } from '../utils/dateHelper';

// ---------------------------------------------------------------------------
// DATA DUMMY SEMENTARA
// Dibuat relatif terhadap waktu sekarang supaya label "Hari ini/Besok" dan status
// jadwal (aktif/mendatang/selesai) selalu terlihat kapan pun aplikasi dibuka.
// Nama kolom masih perkiraan karena skema database belum ada di repo.
// ---------------------------------------------------------------------------

// Timestamp UTC (ISO), seperti kolom timestamptz dari Supabase
const tenggat = (tambahHari, jam) => dayjs().add(tambahHari, 'day').hour(jam).minute(0).second(0).millisecond(0).toISOString();

// Tenggat pada hari ke-n minggu ini (0 = Senin), agar Progres Mingguan tidak kosong di awal minggu
const tenggatMingguIni = (hariKe, jam) => dayjs().locale('id').startOf('week').add(hariKe, 'day').hour(jam).toISOString();

// Jam dinding 'HH:mm:00', dibulatkan ke 5 menit (jadwal di sekitar tengah malam bisa terlihat aneh, wajar untuk dummy)
const jamDariSekarang = (menit) => {
  const t = dayjs().add(menit, 'minute');
  return t.minute(Math.floor(t.minute() / 5) * 5).format('HH:mm:00');
};

const kelas = (nama_mapel, rombel, guru) => ({ nama_mapel, rombel, guru: { nama_lengkap: guru } });

function buatDummySiswa() {
  const jamTenggatHariIni = Math.min(dayjs().hour() + 2, 23);
  return {
    tugas: [
      { id: 't1', judul: 'Latihan Soal Persamaan Linear Dua Variabel', keterangan: '4 Soal Esai', deadline: tenggat(0, jamTenggatHariIni), status_pengumpulan: null, kelas: kelas('Matematika', '9A', 'Pak Hendra') },
      { id: 't2', judul: 'Analytical Exposition Essay Draft', keterangan: 'Min. 300 Kata', deadline: tenggat(1, 8), status_pengumpulan: null, kelas: kelas('Bahasa Inggris', '9C', 'Ms. Ratna') },
      { id: 't3', judul: 'Laporan Praktikum Fotosintesis', keterangan: 'Format PDF', deadline: tenggat(3, 10), status_pengumpulan: null, kelas: kelas('IPA', '9C', 'Bu Sri') },
      { id: 't4', judul: 'Peta Konsep Perdagangan Internasional', keterangan: 'Foto / Gambar', deadline: tenggat(5, 12), status_pengumpulan: null, kelas: kelas('IPS', '9C', 'Pak Budi') },
      { id: 't5', judul: 'Kuis Bangun Ruang Sisi Lengkung', keterangan: '10 Pilihan Ganda', deadline: tenggatMingguIni(0, 20), status_pengumpulan: 'dikumpulkan', kelas: kelas('Matematika', '9A', 'Pak Hendra') },
      { id: 't6', judul: 'Teks Eksplanasi Bencana Alam', keterangan: 'Min. 3 Paragraf', deadline: tenggatMingguIni(2, 20), status_pengumpulan: 'dikumpulkan', kelas: kelas('Bahasa Indonesia', '9C', 'Bu Wati') },
      { id: 't7', judul: 'Sketsa Ragam Hias Nusantara', keterangan: 'Foto Karya', deadline: tenggatMingguIni(4, 15), status_pengumpulan: 'dikumpulkan', kelas: kelas('Seni Budaya', '9C', 'Pak Anton') },
    ],
    jadwal: [
      { id: 'j1', hari: namaHariIni(), jam_mulai: jamDariSekarang(-180), jam_selesai: jamDariSekarang(-90), ruangan: 'Ruang Kelas 9C', kelas: kelas('Bahasa Inggris', '9C', 'Ms. Ratna') },
      { id: 'j2', hari: namaHariIni(), jam_mulai: jamDariSekarang(-30), jam_selesai: jamDariSekarang(60), ruangan: 'Laboratorium Fisika 2', kelas: kelas('Fisika', '9C', 'Bu Sri') },
      { id: 'j3', hari: namaHariIni(), jam_mulai: jamDariSekarang(75), jam_selesai: jamDariSekarang(165), ruangan: 'Ruang Kelas 9C', kelas: kelas('Matematika Dasar', '9A', 'Pak Hendra') },
    ],
  };
}

// `jumlah` pengumpulan untuk satu tugas: `mingguIni` di antaranya masuk minggu ini (sisanya minggu lalu),
// dan `belumDinilai` pengumpulan terbaru belum diberi nilai.
function buatPengumpulan(idTugas, jumlah, belumDinilai, mingguIni) {
  const now = dayjs();
  const awalMinggu = now.locale('id').startOf('week');
  const rentang = now.diff(awalMinggu);
  return Array.from({ length: jumlah }, (_, i) => ({
    id: `${idTugas}-p${i + 1}`,
    submitted_at: (i < mingguIni
      ? now.subtract(Math.round((rentang * (i + 1)) / (mingguIni + 1)), 'millisecond')
      : awalMinggu.subtract(i - mingguIni + 1, 'hour')
    ).toISOString(),
    nilai: i < belumDinilai ? null : 75 + (i % 25),
  }));
}

function buatDummyGuru() {
  const jamTenggatHariIni = Math.min(dayjs().hour() + 2, 23);
  const kelas9A = { nama_mapel: 'Matematika', rombel: '9A', jumlah_siswa: 32 };
  const kelas9C = { nama_mapel: 'Matematika', rombel: '9C', jumlah_siswa: 30 };
  return {
    kelas: [{ id: 'k1', ...kelas9A }, { id: 'k2', ...kelas9C }],
    jadwal: [
      { id: 'j1', hari: namaHariIni(), jam_mulai: jamDariSekarang(-180), jam_selesai: jamDariSekarang(-90), ruangan: 'Ruang 204 • Lantai 2 Gedung A', kelas: kelas9C },
      { id: 'j2', hari: namaHariIni(), jam_mulai: jamDariSekarang(-55), jam_selesai: jamDariSekarang(35), ruangan: 'Ruang 201 • Lantai 2 Gedung A', kelas: kelas9A },
      { id: 'j3', hari: namaHariIni(), jam_mulai: jamDariSekarang(75), jam_selesai: jamDariSekarang(165), ruangan: 'Ruang 204 • Lantai 2 Gedung A', kelas: kelas9C },
    ],
    tugas: [
      { id: 'g1', judul: 'Latihan Soal Persamaan Linear Dua Variabel', deadline: tenggat(0, jamTenggatHariIni), kelas: kelas9A, pengumpulan: buatPengumpulan('g1', 28, 3, 8) },
      { id: 'g2', judul: 'Kuis Bangun Ruang Sisi Lengkung', deadline: tenggat(1, 8), kelas: kelas9C, pengumpulan: buatPengumpulan('g2', 20, 2, 6) },
      { id: 'g3', judul: 'Proyek Statistika Data Kelas', deadline: tenggat(4, 10), kelas: kelas9A, pengumpulan: buatPengumpulan('g3', 6, 0, 6) },
      // Tenggat sudah lewat dan semua sudah dinilai: tidak muncul di daftar Beranda
      { id: 'g4', judul: 'Ulangan Harian Pola Bilangan', deadline: tenggat(-3, 10), kelas: kelas9C, pengumpulan: buatPengumpulan('g4', 30, 0, 0) },
    ],
  };
}

const simulasiJeda = () => new Promise((resolve) => setTimeout(resolve, 500));

// Data Beranda siswa: semua tugas di kelas yang diikuti (+ status pengumpulan milik siswa)
// dan jadwal hari ini. Angka ringkasan dihitung di layar.
// Bentuk data:
//   tugas:  [{ id, judul, keterangan, deadline (ISO UTC), status_pengumpulan (null | 'dikumpulkan'),
//              kelas: { nama_mapel, rombel, guru: { nama_lengkap } } }]
//   jadwal: [{ id, hari ('Senin'), jam_mulai ('07:30:00'), jam_selesai, ruangan,
//              kelas: { nama_mapel, rombel, guru: { nama_lengkap } } }]
export async function getStudentDashboard() {
  // TODO: ganti dengan query Supabase (tugas + submissions milik siswa, jadwal .eq('hari', namaHariIni()))
  // dan kembalikan error dari Supabase apa adanya, seperti authServices.js.
  await simulasiJeda();
  const data = buatDummySiswa();
  return { data: { ...data, jadwal: data.jadwal.filter((j) => j.hari === namaHariIni()) }, error: null };
}

// Data Beranda guru: kelas yang diajar, jadwal mengajar hari ini, dan tugas buatan guru
// beserta pengumpulannya. Angka ringkasan dihitung di layar.
// Bentuk data:
//   kelas:  [{ id, nama_mapel, rombel, jumlah_siswa }]
//   jadwal: [{ id, hari, jam_mulai, jam_selesai, ruangan, kelas: { nama_mapel, rombel } }]
//   tugas:  [{ id, judul, deadline (ISO UTC), kelas: { nama_mapel, rombel, jumlah_siswa },
//              pengumpulan: [{ id, submitted_at (ISO UTC), nilai (null = belum dinilai) }] }]
export async function getTeacherDashboard() {
  // TODO: ganti dengan query Supabase (kelas milik guru, jadwal .eq('hari', namaHariIni()),
  // tugas + submissions) dan kembalikan error dari Supabase apa adanya.
  await simulasiJeda();
  const data = buatDummyGuru();
  return { data: { ...data, jadwal: data.jadwal.filter((j) => j.hari === namaHariIni()) }, error: null };
}
