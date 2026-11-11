import { Timestamp, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from './firebase';

// Dokumen Firestore -> objek biasa. Timestamp diubah jadi string ISO
// supaya layar yang dulu menerima data Supabase tidak perlu diubah.
export function docToObject(snap) {
  const data = snap.data() || {};
  const out = { id: snap.id };
  Object.keys(data).forEach((key) => {
    const value = data[key];
    out[key] = value instanceof Timestamp ? value.toDate().toISOString() : value;
  });
  return out;
}

export function toError(e) {
  if (!e) return null;
  if (e.code === 'permission-denied') {
    return new Error('Akses ditolak oleh aturan keamanan database. Pastikan rules Firestore sudah dipublikasikan.');
  }
  if (e.code === 'unavailable') {
    return new Error('Tidak bisa terhubung ke server. Periksa koneksi internetmu.');
  }
  return e instanceof Error ? e : new Error(String(e));
}

// Pengganti ON DELETE CASCADE: hapus semua dokumen yang cocok dengan kondisi.
// conditions = [['class_id', 'abc'], ['teacher_id', 'xyz']]
export async function deleteWhere(collectionName, conditions) {
  const q = query(
    collection(db, collectionName),
    ...conditions.map(([field, value]) => where(field, '==', value))
  );
  const snap = await getDocs(q);
  for (let i = 0; i < snap.docs.length; i += 400) {
    const batch = writeBatch(db);
    snap.docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    // eslint-disable-next-line no-await-in-loop
    await batch.commit();
  }
}
