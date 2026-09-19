import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { colors, fonts, radius, space } from '../theme';
import { Button } from './Button';
import { T } from './Text';

interface Props {
  open: boolean;
  title: string;
  intro: string;
  reasons: string[];
  submitLabel: string;
  footnote: string;
  onSubmit: (reason: string, note: string) => void;
  onClose: () => void;
}

/** Bottom sheet for "something wrong?" on either side of a delivery. */
export function ReportSheet({ open, title, intro, reasons, submitLabel, footnote, onSubmit, onClose }: Props) {
  const [reason, setReason] = useState<string | null>(null);
  const [note, setNote] = useState('');
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={s.backdrop} onPress={onClose} />
      <View style={s.sheet}>
        <View style={s.handle} />
        <View style={s.head}>
          <T kind="title" style={{ fontSize: 17 }}>
            {title}
          </T>
          <Pressable onPress={onClose} style={s.close}>
            <T style={{ color: colors.muted, fontSize: 12 }}>✕</T>
          </Pressable>
        </View>
        <T kind="caption" style={{ lineHeight: 17 }}>
          {intro}
        </T>
        <View style={{ gap: 6 }}>
          {reasons.map((r) => {
            const on = r === reason;
            return (
              <Pressable key={r} onPress={() => setReason(r)} style={[s.reason, on && s.reasonOn]}>
                <T style={{ fontSize: 14, fontFamily: fonts.bodyMedium }}>{r}</T>
                {on && (
                  <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
                    SELECTED
                  </T>
                )}
              </Pressable>
            );
          })}
        </View>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="Anything that helps (optional)"
          placeholderTextColor={colors.muted}
          multiline
          style={s.note}
        />
        <View style={{ marginTop: 'auto', gap: 8 }}>
          <Button
            title={submitLabel}
            variant="danger"
            disabled={!reason}
            onPress={() => {
              onSubmit(reason!, note.trim());
              setReason(null);
              setNote('');
            }}
          />
          <T kind="caption" style={{ textAlign: 'center' }}>
            {footnote}
          </T>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    height: '78%',
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderColor: colors.line,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 10,
    paddingHorizontal: 18,
    paddingBottom: 24,
    gap: 12,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: colors.line, alignSelf: 'center', marginBottom: 4 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: { width: 28, height: 28, borderRadius: 8, backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  reason: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 13, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground },
  reasonOn: { borderColor: colors.brandB, backgroundColor: 'rgba(252,211,77,0.07)' },
  note: { backgroundColor: colors.ground, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, padding: 12, minHeight: 64, color: colors.ink, fontFamily: fonts.body, fontSize: 14, textAlignVertical: 'top' },
});
