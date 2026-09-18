import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { useAuth } from '../../store/auth';
import { colors, fonts, radius, space } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'Register'>;

const MH = ['A', 'B', 'B-ANX', 'C', 'D', 'D-ANX', 'E', 'F', 'G', 'H', 'J', 'K', 'L', 'M', 'N', 'P', 'Q', 'R', 'T'];
const LH = ['A', 'B', 'C', 'D', 'E', 'E-ANX', 'F', 'G', 'H', 'J', 'S'];
const REG_RE = /^\d{2}[A-Z]{3}\d{4}$/;

/** Frame 1 — Verify you're one of us. Step 1 of 3. */
export function RegisterScreen({ navigation }: Props) {
  const register = useAuth((s) => s.register);
  const [name, setName] = useState('');
  const [regNo, setRegNo] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [block, setBlock] = useState<string | null>(null);
  const [idAttached, setIdAttached] = useState(false);
  const [sheet, setSheet] = useState(false);

  const valid =
    name.trim().length > 1 &&
    REG_RE.test(regNo.trim().toUpperCase()) &&
    /^[^@\s]+@vitstudent\.ac\.in$/i.test(email.trim()) &&
    phone.replace(/\D/g, '').length >= 10 &&
    !!block &&
    idAttached;

  const submit = () => {
    register({ name: name.trim(), regNo, email: email.trim().toLowerCase(), phone: phone.trim(), block: block! });
    navigation.navigate('Otp');
  };

  return (
    <Screen scroll>
      <View style={s.dots}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={[s.dot, i === 0 && s.dotOn]} />
        ))}
      </View>
      <T kind="h1" style={s.h1}>
        Verify you're one of us
      </T>
      <T kind="caption" style={s.sub}>
        A few details to confirm you're a student here — takes a minute.
      </T>

      <Field label="Full name" placeholder="As on your ID card" value={name} onChangeText={setName} />
      <View>
        <Field
          label="Registration number"
          placeholder="e.g. 24BCE1234"
          autoCapitalize="characters"
          autoCorrect={false}
          value={regNo}
          onChangeText={setRegNo}
        />
        <T kind="caption" style={s.hint}>
          As on your ID card — we'll cross-check this
        </T>
      </View>
      <View>
        <Field
          label="VIT email ID"
          placeholder="yourname@vitstudent.ac.in"
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <T kind="caption" style={s.hint}>
          Must be your official @vitstudent.ac.in address
        </T>
      </View>
      <View>
        <Field label="Phone number" placeholder="+91 98765 43210" keyboardType="phone-pad" value={phone} onChangeText={setPhone} />
        <T kind="caption" style={s.hint}>
          Used for delivery updates and OTP verification
        </T>
      </View>

      <View style={{ gap: 6 }}>
        <T kind="eyebrow">Hostel block</T>
        <Pressable onPress={() => setSheet(true)} style={s.picker}>
          <T style={!block && { color: colors.muted }}>{block ?? 'Select your block'}</T>
          <T style={{ color: colors.muted, fontSize: 12 }}>▾</T>
        </Pressable>
      </View>

      <View style={{ gap: 6 }}>
        <T kind="eyebrow">ID card</T>
        {/* ponytail: no image picker yet — tap marks it attached; add expo-image-picker when real upload is wired */}
        <Pressable onPress={() => setIdAttached((v) => !v)} style={[s.upload, idAttached && s.uploadOn]}>
          <View style={s.uploadIcon}>
            <T style={{ fontSize: 17 }}>{idAttached ? '✓' : '📷'}</T>
          </View>
          <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>{idAttached ? 'ID attached' : 'Scan or upload your ID'}</T>
          <T kind="caption" style={{ fontSize: 11.5 }}>
            Clear photo, all corners visible
          </T>
        </Pressable>
      </View>

      <View style={s.trust}>
        <T style={{ color: colors.brandDark, fontSize: 13 }}>🔒</T>
        <T kind="caption" style={{ flex: 1, fontSize: 11.5, lineHeight: 16 }}>
          Used only to verify you're a student here — never shown to other users.
        </T>
      </View>

      <Button title="Continue" onPress={submit} disabled={!valid} style={{ marginTop: space.sm }} />
      <T kind="caption" style={s.foot}>
        Step 1 of 3 · next: <T kind="caption" style={{ color: colors.brandDark }}>verify OTP</T>
      </T>
      <Pressable onPress={() => navigation.navigate('SignIn')}>
        <T kind="caption" style={s.foot}>
          Already registered? <T kind="caption" style={{ color: colors.brandDark }}>Sign in</T>
        </T>
      </Pressable>

      <BlockSheet open={sheet} value={block} onPick={setBlock} onClose={() => setSheet(false)} />
    </Screen>
  );
}

function BlockSheet({ open, value, onPick, onClose }: { open: boolean; value: string | null; onPick: (v: string) => void; onClose: () => void }) {
  const [hostel, setHostel] = useState<'MH' | 'LH'>('MH');
  const [q, setQ] = useState('');
  const rows = useMemo(() => {
    const src = hostel === 'MH' ? MH : LH;
    const needle = q.trim().toUpperCase();
    return src.filter((b) => b.includes(needle)).map((b) => `${hostel}-${b}`);
  }, [hostel, q]);

  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.sheetHead}>
          <T kind="title" style={{ fontSize: 17 }}>
            Select your block
          </T>
          <Pressable onPress={onClose} style={s.close}>
            <T style={{ color: colors.muted, fontSize: 12 }}>✕</T>
          </Pressable>
        </View>
        <View style={s.seg}>
          {(['MH', 'LH'] as const).map((h) => {
            const on = h === hostel;
            return (
              <Pressable
                key={h}
                onPress={() => {
                  setHostel(h);
                  setQ('');
                }}
                style={[s.segBtn, on && s.segOn]}
              >
                <T style={[{ fontSize: 12.5, fontFamily: fonts.bodyMedium, color: colors.muted }, on && { color: colors.onBrand }]}>
                  {h === 'MH' ? "Men's Hostel" : 'Ladies Hostel'}
                </T>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search block (e.g. F, D-ANX)"
          placeholderTextColor={colors.muted}
          autoCapitalize="characters"
          style={s.search}
        />
        <FlatList
          data={rows}
          keyExtractor={(x) => x}
          contentContainerStyle={{ gap: 6 }}
          ListEmptyComponent={<T kind="caption" style={{ textAlign: 'center', paddingVertical: 30 }}>{`No blocks match "${q.trim().toUpperCase()}"`}</T>}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => {
                onPick(item);
                onClose();
              }}
              style={[s.row, item === value && s.rowOn]}
            >
              <T style={{ fontSize: 14, fontFamily: fonts.bodyMedium }}>{item}</T>
              <T kind="mono" style={{ fontSize: 10, color: colors.muted }}>
                {hostel === 'MH' ? "Men's" : 'Ladies'}
              </T>
            </Pressable>
          )}
        />
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  dots: { flexDirection: 'row', gap: 6, marginTop: space.md },
  dot: { width: 22, height: 4, borderRadius: 2, backgroundColor: colors.line },
  dotOn: { backgroundColor: colors.brandB },
  h1: { fontSize: 26, lineHeight: 29, textTransform: 'none', letterSpacing: -0.5 },
  sub: { fontSize: 13.5, lineHeight: 20, maxWidth: 300, marginTop: -space.sm },
  hint: { fontSize: 11, marginTop: 6 },
  picker: {
    height: 52,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  upload: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: colors.line,
    borderRadius: radius.card,
    paddingVertical: 22,
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  uploadOn: { borderColor: colors.brandB, borderStyle: 'solid' },
  uploadIcon: { width: 38, height: 38, borderRadius: 10, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
  trust: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
    backgroundColor: 'rgba(252,211,77,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.18)',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  foot: { textAlign: 'center' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    height: '72%',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 18,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 12 },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 },
  close: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  seg: { flexDirection: 'row', gap: 4, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, borderRadius: 11, padding: 4, marginBottom: 12 },
  segBtn: { flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center' },
  segOn: { backgroundColor: colors.brandB },
  search: {
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingVertical: 11,
    paddingHorizontal: 13,
    color: colors.ink,
    fontFamily: fonts.body,
    fontSize: 13.5,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 13,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.ground,
  },
  rowOn: { borderColor: colors.brandB, backgroundColor: 'rgba(252,211,77,0.07)' },
});
