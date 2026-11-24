import { useUnread } from '../../context/UnreadContext';
import { FloatingSafeAreaView } from '../../components/FloatingTabBar';
import { useAppTheme } from '../../context/ThemeContext';
import AppBackdrop from '../../components/AppBackdrop';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { addDoc, collection, doc, getDoc, getDocs, limit, onSnapshot, orderBy, query, serverTimestamp, where } from 'firebase/firestore';
import { db } from '../../core/firebase';
import { useAuth } from '../../context/AuthContext';
import { colors, radius } from '../../core/theme';

export default function PrivateChatScreen({ route, navigation }) {
  const { colors, mode: appThemeMode } = useAppTheme();
  const s = make_s(colors);

  const { classId, studentId: targetStudentId } = route.params || {};
  const { user, role } = useAuth();
  const uid = user?.uid;
  const teacher = role === 'guru';
  const [klass, setKlass] = useState(null);
  const [members, setMembers] = useState([]);
  const [partner, setPartner] = useState(null);
  const [rows, setRows] = useState([]);
  const [draft, setDraft] = useState('');
  const [inputHeight, setInputHeight] = useState(22);
  const [inputFocused, setInputFocused] = useState(false);
  useEffect(() => { if (!draft) setInputHeight(22); }, [draft]);

  function resizeWebInput(event) {
    const node = event.target;
    if (!node?.style) return;
    const previous = node.style.height;
    node.style.height = '22px';
    const height = node.scrollHeight;
    node.style.height = previous;
    setInputHeight(Math.max(22, Math.min(100, Math.ceil(height))));
  }
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  const [focused, setFocused] = useState(false);
  const lock = useRef(false);
  const studentId = teacher ? partner?.student_id : uid;
  const {markChat,readReady}=useUnread();
  useEffect(()=>{if(focused&&ready&&readReady&&classId&&studentId)markChat(classId,studentId,rows);},[focused,ready,readReady,classId,studentId,rows,markChat]);

  useFocusEffect(useCallback(() => {
    let active = true;
    setFocused(true);
    setLoading(true);
    setError('');
    setKlass(null);
    setMembers([]);
    setPartner(null);
    setDraft('');
    setRows([]);
    setReady(false);
    (async () => {
      try {
        if (!uid || !classId) throw new Error('Kelas atau akun tidak ditemukan.');
        const snap = await getDoc(doc(db, 'classes', classId));
        if (!snap.exists()) throw new Error('Kelas tidak ditemukan.');
        const data = snap.data();
        if (teacher && data.teacher_id !== uid) throw new Error('Kelas bukan milik akun ini.');
        let people = [];
        if (teacher) {
          const result = await getDocs(query(collection(db, 'class_members'), where('class_id', '==', classId), where('teacher_id', '==', uid)));
          people = result.docs.map(d => d.data()).sort((a, b) => (a.student_nama || '').localeCompare(b.student_nama || ''));
        }
        if (active) {
          setKlass(data);
          setMembers(people);
          if (teacher && targetStudentId) setPartner(people.find(p => p.student_id === targetStudentId) || null);
        }
      } catch (e) {
        if (active) setError(e.message || 'Gagal memuat kelas.');
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
      setFocused(false);
    };
  }, [classId, uid, teacher, targetStudentId]));

  useEffect(() => {
    setRows([]);
    setReady(false);
    if (!focused || !klass || !studentId || !classId) return;
    const q = query(collection(db, 'classes', classId, 'private_chats', studentId, 'messages'), orderBy('created_at', 'desc'), limit(100));
    return onSnapshot(q, snap => {
      setRows(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: 'estimate' }), pending: d.metadata.hasPendingWrites })));
      setReady(true);
      setError('');
    }, e => {
      setRows([]);
      setReady(false);
      setError(e.message || 'Chat tidak dapat diakses.');
    });
  }, [focused, klass, classId, studentId]);

  async function send() {
    const isi = draft.trim();
    if (!ready || !isi || !studentId || lock.current) return;
    lock.current = true;
    setSending(true);
    setError('');
    try {
      await addDoc(collection(db, 'classes', classId, 'private_chats', studentId, 'messages'), {
        sender_id: uid,
        isi,
        created_at: serverTimestamp(),
      });
      setDraft('');
    } catch (e) {
      setError(e.message || 'Pesan gagal dikirim.');
    } finally {
      lock.current = false;
      setSending(false);
    }
  }

  const selecting = teacher && !partner;
  const name = selecting ? 'Pilih siswa' : teacher ? partner?.student_nama || 'Siswa' : klass?.teacher_nama || 'Guru pengampu';

  return (
    <FloatingSafeAreaView style={s.safe} edges={['top']}><AppBackdrop />
      <KeyboardAvoidingView
        style={s.keyboardArea}
        behavior={Platform.OS === 'ios' ? 'padding' : Platform.OS === 'android' ? 'height' : undefined}
        enabled={Platform.OS !== 'web'}
        keyboardVerticalOffset={0}
      >
        <View style={s.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Kembali"
            onPress={() => {
              if (teacher && partner && !targetStudentId) {
                setReady(false);
                setPartner(null);
                setDraft('');
                setRows([]);
                setError('');
              } else navigation.goBack();
            }}
            disabled={sending}
            style={s.back}
          >
            <Ionicons name="arrow-back" size={23} color={colors.primary} />
          </Pressable>
          <View style={s.headerTextWrap}>
            <Text style={s.title}>{name}</Text>
            <Text style={s.muted}>{[klass?.nama_mapel, klass?.rombel].filter(Boolean).join(' • ') || 'Chat pribadi'}</Text>
          </View>
          <Ionicons name="chatbubbles-outline" size={23} color={colors.primary} />
        </View>

        {error ? <Text style={s.error}>{error}</Text> : null}

        {loading ? (
          <ActivityIndicator style={s.loading} color={colors.primary} />
        ) : !klass ? null : selecting ? (
          <FlatList
            data={members}
            keyExtractor={(x) => x.student_id}
            contentContainerStyle={s.list}
            ListEmptyComponent={<Text style={s.muted}>Belum ada anggota kelas.</Text>}
            renderItem={({ item }) => (
              <Pressable style={s.person} onPress={() => { setReady(false); setError(''); setPartner(item); }}>
                <Ionicons name="person-circle-outline" size={36} color={colors.primary} />
                <View style={s.personTextWrap}>
                  <Text style={s.name}>{item.student_nama || 'Siswa'}</Text>
                  
                </View>
                <Ionicons name="chevron-forward" color={colors.textMuted} size={20} />
              </Pressable>
            )}
          />
        ) : (
          <>
            {!ready && !error ? <ActivityIndicator style={s.subLoading} color={colors.primary} /> : null}
            <FlatList
              inverted
              style={s.chatList}
              data={rows}
              keyExtractor={(x) => x.id}
              contentContainerStyle={s.list}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={ready ? <Text style={[s.muted, s.emptyText]}>Belum ada pesan. Mulai percakapan!</Text> : null}
              renderItem={({ item }) => {
                const mine = item.sender_id === uid;
                const date = item.created_at?.toDate?.();
                return (
                  <View style={[s.bubble, mine ? s.mine : s.other]}>
                    <Text style={s.message}>{item.isi}</Text>
                    <Text style={s.time}>
                      {item.pending ? 'Mengirim…' : date ? date.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''}
                    </Text>
                  </View>
                );
              }}
            />

            <View style={s.composer}>
              <View style={[s.inputShell, inputFocused && s.inputFocused]}>
                <TextInput
                  value={draft}
                  onChangeText={setDraft}
                  editable={!sending && ready}
                  placeholder="Tulis pesan..."
                  placeholderTextColor={colors.textMuted}
                  maxLength={2000}
                  multiline
                  underlineColorAndroid="transparent"
                  onFocus={() => setInputFocused(true)}
                  onBlur={() => setInputFocused(false)}
                  {...(Platform.OS === 'web' ? { rows: 1, onChange: resizeWebInput } : {
                    onContentSizeChange: ({ nativeEvent }) => setInputHeight(Math.max(22, Math.min(100, Math.ceil(nativeEvent.contentSize.height)))),
                  })}
                  style={[s.input, { height: draft ? inputHeight : 22 }, Platform.OS === 'web' && { outlineStyle: 'none' }]}
                />
              </View>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Kirim pesan"
                disabled={!ready || !draft.trim() || sending}
                onPress={send}
                style={[s.send, (!ready || !draft.trim() || sending) && s.sendDisabled]}
              >
                <Ionicons name="send" size={21} color="white" />
              </Pressable>
            </View>
          </>
        )}
      </KeyboardAvoidingView>
    </FloatingSafeAreaView>
  );
}

const make_s = (colors) => (StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderBottomWidth: 1, borderColor: colors.border },
  headerTextWrap: { flex: 1 },
  back: { padding: 8 },
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  muted: { fontSize: 13, color: colors.textMuted },
  error: { color: colors.danger, paddingHorizontal: 12, paddingTop: 12 },
  loading: { margin: 24 },
  subLoading: { margin: 12 },
  list: { padding: 16, gap: 10 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, backgroundColor: colors.card, borderRadius: radius.md },
  personTextWrap: { flex: 1 },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  keyboardArea: { flex: 1, minHeight: 0 },
  chatList: { flex: 1, minHeight: 0 },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '82%', minWidth: 85 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.chatMine },
  other: { alignSelf: 'flex-start', backgroundColor: colors.cardAlt },
  message: { color: colors.text, fontSize: 16, lineHeight: 22 },
  time: { color: colors.chatTime, fontSize: 11, marginTop: 6, textAlign: 'right' },
  emptyText: { textAlign: 'center' },
  composer: {
    flexShrink: 0,
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 10,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
  },
  inputShell: {
    flex: 1,
    minHeight: 48,
    paddingHorizontal: 13,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: colors.cardAlt,
    borderWidth: 1,
    borderColor: colors.border,
    justifyContent: 'center',
  },
  inputFocused: { borderColor: colors.primary },
  input: {
    width: '100%',
    minHeight: 22,
    maxHeight: 100,
    borderWidth: 0,
    backgroundColor: 'transparent',
    includeFontPadding: false,
    color: colors.text,
    fontSize: 15,
    lineHeight: 22,
    paddingTop: 0,
    paddingBottom: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: 'top',
  },
  send: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
    marginBottom: 0,
  },
  sendDisabled: { opacity: 0.4 },
}));
