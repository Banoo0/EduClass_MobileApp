import { supabase } from '../core/supabase';

export async function fetchScheduleMeetings(scheduleId) {
  const { data, error } = await supabase
    .from('meetings')
    .select('id, schedule_id, tanggal, topik, deskripsi, presensi_dibuka_at, presensi_ditutup_at')
    .eq('schedule_id', scheduleId)
    .order('tanggal', { ascending: false });
  return { data: data ?? [], error };
}

export async function createMeeting({ scheduleId, tanggal, topik, deskripsi }) {
  const { data, error } = await supabase
    .from('meetings')
    .insert({
      schedule_id: scheduleId,
      tanggal,
      topik: topik.trim(),
      deskripsi: deskripsi.trim(),
    })
    .select('id, schedule_id, tanggal, topik, deskripsi, presensi_dibuka_at, presensi_ditutup_at')
    .single();
  return { data, error };
}

export async function updateMeeting({ meetingId, tanggal, topik, deskripsi }) {
  const { data, error } = await supabase
    .from('meetings')
    .update({ tanggal, topik: topik.trim(), deskripsi: deskripsi.trim() })
    .eq('id', meetingId)
    .select('id, schedule_id, tanggal, topik, deskripsi, presensi_dibuka_at, presensi_ditutup_at')
    .single();
  return { data, error };
}

export async function deleteMeeting(meetingId) {
  const { data, error } = await supabase
    .from('meetings')
    .delete()
    .eq('id', meetingId)
    .select('id')
    .maybeSingle();
  return { data, error };
}

export async function setMeetingAttendanceOpen(meeting, open) {
  const changes = open
    ? { presensi_dibuka_at: new Date().toISOString(), presensi_ditutup_at: null }
    : { presensi_ditutup_at: new Date().toISOString() };

  const { data, error } = await supabase
    .from('meetings')
    .update(changes)
    .eq('id', meeting.id)
    .select('id, schedule_id, tanggal, topik, deskripsi, presensi_dibuka_at, presensi_ditutup_at')
    .single();
  return { data, error };
}

export async function fetchMeetingRoster(classId, meetingId) {
  const { data: memberships, error: memberError } = await supabase
    .from('class_members')
    .select('student_id')
    .eq('class_id', classId);
  if (memberError) return { data: null, error: memberError };

  const studentIds = [...new Set((memberships || []).map((row) => row.student_id).filter(Boolean))];
  if (studentIds.length === 0) return { data: [], error: null };

  const [profilesResult, attendanceResult] = await Promise.all([
    supabase.from('profiles').select('id, nama_lengkap, nomor_induk').in('id', studentIds),
    supabase.from('attendances').select('id, student_id, status, waktu_absen').eq('meeting_id', meetingId),
  ]);

  if (profilesResult.error) return { data: null, error: profilesResult.error };
  if (attendanceResult.error) return { data: null, error: attendanceResult.error };

  const attendanceByStudent = Object.fromEntries(
    (attendanceResult.data || []).map((row) => [row.student_id, row])
  );
  return {
    data: (profilesResult.data || [])
      .map((student) => ({ ...student, attendance: attendanceByStudent[student.id] || null }))
      .sort((a, b) => (a.nama_lengkap || '').localeCompare(b.nama_lengkap || '')),
    error: null,
  };
}

export async function saveMeetingAttendance({ meetingId, studentId, status }) {
  const { data, error } = await supabase
    .from('attendances')
    .upsert(
      {
        meeting_id: meetingId,
        student_id: studentId,
        status,
        waktu_absen: new Date().toISOString(),
      },
      { onConflict: 'meeting_id,student_id' }
    )
    .select('id, meeting_id, student_id, status, waktu_absen')
    .single();
  return { data, error };
}
