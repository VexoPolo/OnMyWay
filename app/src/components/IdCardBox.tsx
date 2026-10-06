import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { StyleSheet, View } from 'react-native';
import { colors, fonts, radius } from '../theme';
import { Tap } from './Tap';
import { T } from './Text';

export type IdCardPhoto = { uri: string; mimeType?: string };

/** The ID card upload box from Registration: tap to pick a photo from the library. */
export function IdCardBox({ value, onChange }: { value?: IdCardPhoto; onChange: (p: IdCardPhoto) => void }) {
  const pick = async () => {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    const a = res.canceled ? undefined : res.assets[0];
    if (a) onChange({ uri: a.uri, mimeType: a.mimeType ?? undefined });
  };
  return (
    <View style={{ gap: 6 }}>
      <T kind="eyebrow">ID card</T>
      <Tap onPress={pick} style={[s.upload, value && s.uploadOn]}>
        <View style={s.uploadIcon}>
          <Ionicons name={value ? 'checkmark' : 'camera-outline'} size={20} color={value ? colors.brandDark : colors.ink} />
        </View>
        <T style={{ fontSize: 13.5, fontFamily: fonts.bodyMedium }}>{value ? 'ID attached — tap to change' : 'Upload a photo of your ID'}</T>
        <T kind="caption" style={{ fontSize: 11.5 }}>
          Clear photo, all corners visible
        </T>
      </Tap>
      <T kind="caption" style={{ fontSize: 11.5 }}>
        Used only to confirm you're a VIT student. Your card is checked automatically, and if it's unsure a team member may look. Deleted after the check, and within 14 days at most.
      </T>
    </View>
  );
}

const s = StyleSheet.create({
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
});
