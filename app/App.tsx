import { Archivo_800ExtraBold, Archivo_900Black } from '@expo-google-fonts/archivo';
import { IBMPlexMono_400Regular, IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono';
import { IBMPlexSans_400Regular, IBMPlexSans_500Medium, IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Logo } from './src/components/Logo';
import { RootNavigator } from './src/navigation/RootNavigator';
import { SplashScreen } from './src/screens/SplashScreen';
import { useAuth } from './src/store/auth';
import { startSync } from './src/store/orders';
import { colors } from './src/theme';

export default function App() {
  const [splashDone, setSplashDone] = useState(false);
  const signedIn = useAuth((s) => !!s.user);
  useEffect(() => (signedIn ? startSync() : undefined), [signedIn]); // live orders while signed in
  const [ready] = useFonts({
    Archivo_800ExtraBold,
    Archivo_900Black,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });

  // On a laptop the web build sits in a 390×844 phone frame; on a phone it fills the screen.
  const { width } = useWindowDimensions();
  const framed = Platform.OS === 'web' && width > 480;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {ready ? (
        <View style={framed ? s.desk : s.fill}>
          <View style={framed ? s.phone : s.fill}>
            <RootNavigator />
            {!splashDone && <SplashScreen onDone={() => setSplashDone(true)} />}
          </View>
        </View>
      ) : (
        <View style={{ flex: 1, backgroundColor: colors.ground, alignItems: 'center', justifyContent: 'center' }}>
          <Logo variant="full" height={120} />
        </View>
      )}
    </SafeAreaProvider>
  );
}

const s = StyleSheet.create({
  fill: { flex: 1 },
  desk: { flex: 1, backgroundColor: '#050505', alignItems: 'center', justifyContent: 'center' },
  phone: { width: 390, height: 844, maxHeight: '100%', overflow: 'hidden', borderRadius: 28, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.ground },
});
