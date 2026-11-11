
import { supabase } from '../core/supabase';

const CLASS_FIELDS = `
  id,
  teacher_id,
  nama_mapel,
  rombel,
  tahun_ajaran,
  semester,
  token,
  aktif,
  created_at
`;

const SCHEDULE_FIELDS = `
  id,
  class_id,
  teacher_id,
  judul,
  hari,
  jam_mulai,
  jam_selesai,
  ruang,
  gedung,
  meeting_url,
  created_at
`;

// =====================================================
// KELAS GURU
// =====================================================

export async function fetchTeacherClasses(teacherId) {
  if (!teacherId) {
    return {
      data: null,
      error: new Error('Akun guru tidak ditemukan.'),
    };
  }

  const { data, error } = await supabase
    .from('classes')
    .select(`
      ${CLASS_FIELDS},
      class_members(count),
      schedules(
        id,
        class_id,
        teacher_id,
        judul,
        hari,
        jam_mulai,
        jam_selesai,
        ruang,
        gedung,
        meeting_url,
        created_at
      )
    `)
    .eq('teacher_id', teacherId)
    .order('created_at', { ascending: false });

  if (error) return { data: null, error };

  return {
    data: (data || []).map((item) => ({
      ...item,
      jumlah_siswa: Number(
        item.class_members?.[0]?.count || 0
      ),
      schedules: [...(item.schedules || [])].sort((a, b) =>
        String(a.jam_mulai).localeCompare(String(b.jam_mulai))
      ),
    })),
    error: null,
  };
}

// =====================================================
// BUAT KELAS + JADWAL PERTAMA
// Menggunakan dua operasi tabel, tanpa SQL function baru.
// =====================================================

export async function createClass({
  teacherId,
  nama_mapel,
  rombel,
  tahun_ajaran,
  semester,
  hari,
  jam_mulai,
  jam_selesai,
  ruang,
  gedung,
}) {
  if (!teacherId) {
    return {
      data: null,
      schedule: null,
      scheduleError: null,
      error: new Error('Akun guru tidak ditemukan.'),
    };
  }

  if (!nama_mapel?.trim()) {
    return {
      data: null,
      schedule: null,
      scheduleError: null,
      error: new Error('Nama mata pelajaran wajib diisi.'),
    };
  }

  const { data: kelas, error: classError } = await supabase
    .from('classes')
    .insert({
      teacher_id: teacherId,
      nama_mapel: nama_mapel.trim(),
      rombel: rombel?.trim() || null,
      tahun_ajaran: tahun_ajaran?.trim() || null,
      semester: semester?.trim() || null,
      aktif: true,
    })
    .select(CLASS_FIELDS)
    .single();

  if (classError) {
    return {
      data: null,
      schedule: null,
      scheduleError: null,
      error: classError,
    };
  }

  // Token dibuat oleh trigger database yang sudah ada.
  const { data: jadwal, error: scheduleError } = await supabase
    .from('schedules')
    .insert({
      class_id: kelas.id,
      teacher_id: teacherId,
      judul: kelas.nama_mapel,
      hari,
      jam_mulai,
      jam_selesai,
      ruang: ruang?.trim() || null,
      gedung: gedung?.trim() || null,
    })
    .select(SCHEDULE_FIELDS)
    .single();

  return {
    data: kelas,
    schedule: jadwal || null,
    scheduleError: scheduleError || null,
    error: null,
  };
}

// =====================================================
// EDIT INFORMASI KELAS
// =====================================================

export async function updateTeacherClass(
  classId,
  teacherId,
  fields
) {
  if (!fields.nama_mapel?.trim()) {
    return {
      data: null,
      error: new Error('Nama mata pelajaran wajib diisi.'),
    };
  }

  const { data, error } = await supabase
    .from('classes')
    .update({
      nama_mapel: fields.nama_mapel.trim(),
      rombel: fields.rombel?.trim() || null,
      tahun_ajaran: fields.tahun_ajaran?.trim() || null,
      semester: fields.semester?.trim() || null,
    })
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .select(CLASS_FIELDS)
    .maybeSingle();

  if (error) return { data: null, error };

  if (!data) {
    return {
      data: null,
      error: new Error(
        'Kelas tidak ditemukan atau kamu tidak memiliki akses.'
      ),
    };
  }

  return { data, error: null };
}

// =====================================================
// HAPUS KELAS
// Perhatikan relasi ON DELETE CASCADE yang sudah ada.
// =====================================================

export async function deleteTeacherClass(classId, teacherId) {
  const { data, error } = await supabase
    .from('classes')
    .delete()
    .eq('id', classId)
    .eq('teacher_id', teacherId)
    .select('id')
    .maybeSingle();

  if (error) return { data: null, error };

  if (!data) {
    return {
      data: null,
      error: new Error(
        'Kelas tidak ditemukan atau kamu tidak memiliki akses.'
      ),
    };
  }

  return { data, error: null };
}

// =====================================================
// AKTIF / NONAKTIF TOKEN KELAS
// =====================================================

export async function setClassActive(
  classId,
  aktif,
  teacherId
) {
  let query = supabase
    .from('classes')
    .update({ aktif })
    .eq('id', classId);

  if (teacherId) {
    query = query.eq('teacher_id', teacherId);
  }

  const { data, error } = await query
    .select(CLASS_FIELDS)
    .maybeSingle();

  if (error) return { data: null, error };

  if (!data) {
    return {
      data: null,
      error: new Error(
        'Kelas tidak ditemukan atau tidak dapat diubah.'
      ),
    };
  }

  return { data, error: null };
}

// =====================================================
// CRUD JADWAL KELAS
// scheduleId kosong = tambah jadwal.
// scheduleId terisi = edit jadwal.
// =====================================================

export async function saveClassSchedule({
  classId,
  teacherId,
  scheduleId = null,
  judul,
  hari,
  jam_mulai,
  jam_selesai,
  ruang,
  gedung,
}) {
  if (!classId || !teacherId) {
    return {
      data: null,
      error: new Error('Informasi kelas atau guru tidak ditemukan.'),
    };
  }

  if (!hari || !jam_mulai || !jam_selesai) {
    return {
      data: null,
      error: new Error('Hari dan jam wajib diisi.'),
    };
  }

  if (jam_selesai <= jam_mulai) {
    return {
      data: null,
      error: new Error('Jam selesai harus setelah jam mulai.'),
    };
  }

  const payload = {
    class_id: classId,
    teacher_id: teacherId,
    judul: judul?.trim() || null,
    hari,
    jam_mulai,
    jam_selesai,
    ruang: ruang?.trim() || null,
    gedung: gedung?.trim() || null,
  };

  let query;

  if (scheduleId) {
    query = supabase
      .from('schedules')
      .update(payload)
      .eq('id', scheduleId)
      .eq('class_id', classId)
      .eq('teacher_id', teacherId);
  } else {
    query = supabase
      .from('schedules')
      .insert(payload);
  }

  const { data, error } = await query
    .select(SCHEDULE_FIELDS)
    .maybeSingle();

  if (error) return { data: null, error };

  if (!data) {
    return {
      data: null,
      error: new Error(
        'Jadwal tidak ditemukan atau tidak dapat disimpan.'
      ),
    };
  }

  return { data, error: null };
}

export async function deleteClassSchedule(
  scheduleId,
  classId,
  teacherId
) {
  const { data, error } = await supabase
    .from('schedules')
    .delete()
    .eq('id', scheduleId)
    .eq('class_id', classId)
    .eq('teacher_id', teacherId)
    .select('id')
    .maybeSingle();

  if (error) return { data: null, error };

  if (!data) {
    return {
      data: null,
      error: new Error(
        'Jadwal tidak ditemukan atau kamu tidak memiliki akses.'
      ),
    };
  }

  return { data, error: null };
}

// =====================================================
// SEMUA JADWAL MILIK GURU
// =====================================================

export async function fetchTeacherSchedules(teacherId) {
  if (!teacherId) {
    return {
      data: null,
      error: new Error('Akun guru tidak ditemukan.'),
    };
  }

  const { data, error } = await supabase
    .from('schedules')
    .select(`
      ${SCHEDULE_FIELDS},
      classes(
        id,
        nama_mapel,
        rombel,
        tahun_ajaran,
        semester
      )
    `)
    .eq('teacher_id', teacherId);

  return { data, error };
}

// =====================================================
// LAYANAN SISWA — TETAP TERSEDIA
// =====================================================

export async function joinClassByToken(token) {
  const normalizedToken = String(token || '')
    .trim()
    .toUpperCase();

  if (!normalizedToken) {
    return {
      data: null,
      error: new Error('Masukkan token kelas.'),
    };
  }

  const { data, error } = await supabase.rpc('join_class', {
    p_token: normalizedToken,
  });

  return { data, error };
}

export async function fetchStudentClasses(studentId) {
  if (!studentId) {
    return {
      data: null,
      error: new Error('Akun siswa tidak ditemukan.'),
    };
  }

  const { data: memberships, error: memberError } =
    await supabase
      .from('class_members')
      .select('class_id')
      .eq('student_id', studentId);

  if (memberError) return { data: null, error: memberError };

  const classIds = [
    ...new Set(
      (memberships || [])
        .map((item) => item.class_id)
        .filter(Boolean)
    ),
  ];

  if (!classIds.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from('classes')
    .select(CLASS_FIELDS)
    .in('id', classIds)
    .order('nama_mapel');

  return { data, error };
}

export async function fetchStudentSchedules(studentId) {
  if (!studentId) {
    return {
      data: null,
      error: new Error('Akun siswa tidak ditemukan.'),
    };
  }

  const { data: memberships, error: memberError } =
    await supabase
      .from('class_members')
      .select('class_id')
      .eq('student_id', studentId);

  if (memberError) return { data: null, error: memberError };

  const classIds = [
    ...new Set(
      (memberships || [])
        .map((item) => item.class_id)
        .filter(Boolean)
    ),
  ];

  if (!classIds.length) return { data: [], error: null };

  const { data, error } = await supabase
    .from('schedules')
    .select(`
      id,
      class_id,
      teacher_id,
      judul,
      hari,
      jam_mulai,
      jam_selesai,
      ruang,
      gedung,
      meeting_url,
      classes(
        id,
        nama_mapel,
        rombel
      )
    `)
    .in('class_id', classIds)
    .order('jam_mulai', { ascending: true });

  return { data, error };
}
