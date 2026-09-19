import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/Button';
import { Logo } from '../../components/Logo';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { colors, fonts, space } from '../../theme';

const route = require('../../../assets/welcome-route.svg');

type Props = NativeStackScreenProps<AuthStackParams, 'Welcome'>;

/**
 * First screen after the splash — option F: one route, two people.
 * Courier at the gate, requester at the block, both get equal billing.
 */
export function WelcomeScreen({ navigation }: Props) {
  return (
    <View style={s.root}>
      <SafeAreaView style={s.safe}>
        <View style={s.top}>
          <Logo variant="mark" height={26} />
          <View style={s.chip}>
            <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>VIT VELLORE</T>
          </View>
        </View>

        <Text style={s.h1}>
          One <Text style={s.em}>waits.</Text>{'\n'}One <Text style={s.em}>walks.</Text>{'\n'}Both win.
        </Text>

        <View style={s.scene}>
          <Image source={route} style={StyleSheet.absoluteFill} contentFit="contain" />
          <Who tag="COURIER" tagColor={colors.brandDark} title="Going that way anyway" body="Picks it up at the gate, earns ₹20–30 per parcel." style={{ left: 0, top: 12 }} />
          <Who tag="REQUESTER" tagColor="#B79CFF" title="Waiting in the block" body="Gets it at the door, pays cash or UPI." style={{ right: 0, bottom: 8, alignItems: 'flex-end' }} right />
        </View>

        <T kind="caption" style={s.lead}>
          Whichever one you are today. Same account, switch any time.
        </T>
        <View style={s.actions}>
          <Button title="Get started" onPress={() => navigation.navigate('Register')} />
          <Button title="Sign in" variant="ghost" onPress={() => navigation.navigate('SignIn')} />
        </View>
      </SafeAreaView>
    </View>
  );
}

function Who({ tag, tagColor, title, body, style, right }: { tag: string; tagColor: string; title: string; body: string; style: object; right?: boolean }) {
  const align = right ? ('right' as const) : ('left' as const);
  return (
    <View style={[s.who, style]}>
      <T kind="mono" style={{ fontSize: 10, color: tagColor, textAlign: align }}>{tag}</T>
      <T style={{ fontSize: 13, fontFamily: fonts.bodySemi, textAlign: align }}>{title}</T>
      <T kind="caption" style={{ fontSize: 11, lineHeight: 15, textAlign: align }}>{body}</T>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  safe: { flex: 1, paddingHorizontal: 22, paddingBottom: 22, paddingTop: 8 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chip: { borderWidth: 1, borderColor: 'rgba(252,211,77,0.3)', borderRadius: 999, paddingVertical: 5, paddingHorizontal: 10 },
  h1: { fontFamily: fonts.displayBlack, fontSize: 44, lineHeight: 44, letterSpacing: -1.5, color: colors.ink, textTransform: 'uppercase', marginTop: space.lg },
  em: { color: colors.brandDark },
  scene: { flex: 1, marginTop: space.sm, minHeight: 240 },
  who: { position: 'absolute', maxWidth: 170, gap: 3, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingVertical: 9, paddingHorizontal: 11 },
  lead: { fontSize: 14, lineHeight: 21, marginBottom: space.sm },
  actions: { gap: 10 },
});
