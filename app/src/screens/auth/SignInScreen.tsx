import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { ERROR_COPY, toApiError } from '../../services/backend/errors';
import { useAuth } from '../../store/auth';
import { space } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'SignIn'>;

// Shape only. Which domains may sign in is decided by the server (app_config.allowed_email_domains).
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export function SignInScreen({ navigation }: Props) {
  const sendCode = useAuth((s) => s.sendCode);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await sendCode(email);
      navigation.navigate('Otp');
    } catch (e) {
      setError(ERROR_COPY[toApiError(e).code]);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <Logo variant="lockup" height={36} />
      </View>
      <T kind="h1">Sign in</T>
      <T kind="caption">We'll email you a code. Your VIT email is the proof you belong on campus.</T>
      <View style={s.form}>
        <Field
          label="VIT email ID"
          placeholder="yourname@vitstudent.ac.in"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          error={error}
        />
        <Button title="Send me a code" onPress={submit} loading={busy} disabled={!EMAIL_RE.test(email.trim())} />
        <Button title="New here? Register" variant="ghost" onPress={() => navigation.navigate('Register')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: space.xl },
  form: { gap: space.md, marginTop: space.sm },
});
