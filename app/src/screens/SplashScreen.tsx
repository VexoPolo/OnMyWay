import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { colors } from '../theme';

const mark = require('../../assets/logo/onmyway-mark.png');
const word = require('../../assets/logo/onmyway-wordmark.png');

const MARK_W = 220, MARK_H = 220 * (221 / 532);
const WORD_W = 170, WORD_H = 170 * (127 / 502);
const GAP = 18;
const ROW = MARK_H / 2 + GAP + WORD_H / 2; // vertical distance mark row → word row
const ease = Easing.bezier(0.4, 0, 0.2, 1);

/**
 * Option B — "to the gate and back". A little courier walks the mark left→right
 * revealing it, hops to the word line, turns, and walks back with OnMyWay
 * unrolling behind him. ~3.5 s, then onDone.
 */
export function SplashScreen({ onDone }: { onDone: () => void }) {
  const markW = useRef(new Animated.Value(0)).current;
  const wordW = useRef(new Animated.Value(0)).current;
  const x = useRef(new Animated.Value(-118)).current;
  const y = useRef(new Animated.Value(0)).current;
  const dir = useRef(new Animated.Value(1)).current;
  const walker = useRef(new Animated.Value(1)).current;
  const step = useRef(new Animated.Value(0)).current;
  const fade = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const legs = Animated.loop(
      Animated.sequence([
        Animated.timing(step, { toValue: 1, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(step, { toValue: 0, duration: 300, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ]),
    );
    legs.start();
    Animated.sequence([
      Animated.delay(200),
      // out: along the mark
      Animated.parallel([
        Animated.timing(x, { toValue: 118, duration: 1800, easing: ease, useNativeDriver: true }),
        Animated.timing(markW, { toValue: MARK_W, duration: 1800, easing: ease, useNativeDriver: false }),
      ]),
      // hop down + turn
      Animated.parallel([
        Animated.timing(y, { toValue: ROW, duration: 130, easing: ease, useNativeDriver: true }),
        Animated.timing(dir, { toValue: -1, duration: 130, useNativeDriver: true }),
      ]),
      // back: along the word
      Animated.parallel([
        Animated.timing(x, { toValue: -82, duration: 1400, easing: ease, useNativeDriver: true }),
        Animated.timing(wordW, { toValue: WORD_W, duration: 1400, easing: ease, useNativeDriver: false }),
      ]),
      Animated.timing(walker, { toValue: 0, duration: 300, useNativeDriver: true }),
      Animated.delay(250),
      Animated.timing(fade, { toValue: 0, duration: 300, useNativeDriver: true }),
    ]).start(() => {
      legs.stop();
      onDone();
    });
  }, [fade, markW, onDone, step, walker, wordW, x, y, dir]);

  const legL = step.interpolate({ inputRange: [0, 1], outputRange: ['-28deg', '28deg'] });
  const legR = step.interpolate({ inputRange: [0, 1], outputRange: ['28deg', '-28deg'] });

  return (
    <Animated.View style={[s.root, { opacity: fade }]} pointerEvents="none">
      <View style={s.stage}>
        <View style={{ width: MARK_W, height: MARK_H }}>
          <Animated.View style={[s.clipL, { width: markW }]}>
            <Image source={mark} style={{ width: MARK_W, height: MARK_H }} contentFit="contain" />
          </Animated.View>
        </View>
        <View style={{ width: WORD_W, height: WORD_H }}>
          <Animated.View style={[s.clipR, { width: wordW }]}>
            <Image source={word} style={{ width: WORD_W, height: WORD_H }} contentFit="contain" />
          </Animated.View>
        </View>

        {/* the courier */}
        <Animated.View
          style={[
            s.walker,
            { top: -MARK_H / 2 - 14 - 4 + (MARK_H + GAP + WORD_H) / 2 - 6, opacity: walker },
            { transform: [{ translateX: x }, { translateY: y }, { scaleX: dir }] },
          ]}
        >
          <View style={s.head} />
          <View style={s.body} />
          <Animated.View style={[s.arm, { transform: [{ rotate: legR }, { translateY: 7 }] }]} />
          <View style={s.parcel} />
          <Animated.View style={[s.leg, { transform: [{ rotate: legL }, { translateY: 6 }] }]} />
          <Animated.View style={[s.leg, { transform: [{ rotate: legR }, { translateY: 6 }] }]} />
        </Animated.View>
      </View>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center', zIndex: 10 },
  stage: { alignItems: 'center', gap: GAP },
  clipL: { position: 'absolute', left: 0, top: 0, height: MARK_H, overflow: 'hidden' },
  clipR: { position: 'absolute', right: 0, top: 0, height: WORD_H, overflow: 'hidden', alignItems: 'flex-end' },
  walker: { position: 'absolute', width: 22, height: 28, alignItems: 'center' },
  head: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.brandA },
  body: { width: 2.4, height: 10, backgroundColor: colors.brandA, borderRadius: 1.2 },
  arm: { position: 'absolute', top: 9, width: 2.2, height: 8, borderRadius: 1.1, backgroundColor: colors.brandA },
  parcel: { position: 'absolute', top: 12, right: -2, width: 6, height: 5, borderRadius: 1, backgroundColor: colors.brandB },
  leg: { position: 'absolute', top: 16, width: 2.4, height: 11, borderRadius: 1.2, backgroundColor: colors.brandA },
});
