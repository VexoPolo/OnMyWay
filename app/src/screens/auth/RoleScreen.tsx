import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, View } from 'react-native';
import { T } from '../../components/Text';
import { useAuth } from '../../store/auth';
import type { Role } from '../../store/types';
import { brandGradient, colors, fonts } from '../../theme';

/** Frame 2 — Role choice. Two halves, tap one. Step 3 of 3. */
export function RoleScreen() {
  const setRole = useAuth((s) => s.setRole);
  return (
    <View style={s.root}>
      <Half
        role="courier"
        icon="🛵"
        title="Deliver & earn"
        body="Pick up parcels on your way back to the block"
        chip="₹20–30 per pickup"
        glow={['rgba(252,211,77,0.45)', 'rgba(245,158,11,0.28)', 'rgba(10,10,10,0)'] as const}
        glowStart={{ x: 0.5, y: 0 }}
        glowEnd={{ x: 0.5, y: 0.9 }}
        onPress={() => setRole('courier')}
        bordered
      />
      <View style={s.or}>
        <T kind="mono" style={{ fontSize: 10, color: colors.muted, letterSpacing: 0.4 }}>
          OR
        </T>
      </View>
      <Half
        role="customer"
        icon="📦"
        title="Get something delivered"
        body="Skip the walk to the gate — someone's already headed your way"
        chip="Avg. wait ~20 min"
        glow={['rgba(10,10,10,0)', 'rgba(245,158,11,0.10)'] as const}
        glowStart={{ x: 0.5, y: 0.2 }}
        glowEnd={{ x: 0.5, y: 1 }}
        onPress={() => setRole('customer')}
      />
    </View>
  );
}

function Half(p: {
  role: Role;
  icon: string;
  title: string;
  body: string;
  chip: string;
  glow: readonly [string, string, ...string[]];
  glowStart: { x: number; y: number };
  glowEnd: { x: number; y: number };
  onPress: () => void;
  bordered?: boolean;
}) {
  return (
    <Pressable onPress={p.onPress} style={({ pressed }) => [s.half, p.bordered && s.halfBorder, pressed && { opacity: 0.85 }]}>
      <LinearGradient colors={p.glow} start={p.glowStart} end={p.glowEnd} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[...brandGradient]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.icon}>
        <T style={{ fontSize: 26 }}>{p.icon}</T>
      </LinearGradient>
      <T style={s.title}>{p.title}</T>
      <T style={s.body}>{p.body}</T>
      <View style={s.chip}>
        <T kind="mono" style={{ fontSize: 10.5, color: colors.brandDark }}>
          {p.chip}
        </T>
      </View>
    </Pressable>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ground },
  half: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30, gap: 10, overflow: 'hidden' },
  halfBorder: { borderBottomWidth: 1, borderColor: colors.line },
  icon: { width: 56, height: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  title: { fontFamily: fonts.displayBlack, fontSize: 22, letterSpacing: -0.2, textAlign: 'center' },
  body: { fontSize: 13, lineHeight: 19, color: colors.muted, textAlign: 'center', maxWidth: 240 },
  chip: {
    marginTop: 6,
    backgroundColor: 'rgba(252,211,77,0.09)',
    borderWidth: 1,
    borderColor: 'rgba(252,211,77,0.22)',
    borderRadius: 6,
    paddingVertical: 4,
    paddingHorizontal: 9,
  },
  or: {
    position: 'absolute',
    top: '50%',
    alignSelf: 'center',
    marginTop: -13,
    zIndex: 5,
    backgroundColor: colors.ground,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingVertical: 5,
    paddingHorizontal: 12,
  },
});
