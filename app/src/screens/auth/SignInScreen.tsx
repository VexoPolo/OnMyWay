import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button } from '../../components/Button';
import { Field } from '../../components/Field';
import { Logo } from '../../components/Logo';
import { Screen } from '../../components/Screen';
import { T } from '../../components/Text';
import type { AuthStackParams } from '../../navigation/types';
import { api } from '../../services/mock';
import { useAuth } from '../../store/auth';
import { space } from '../../theme';

type Props = NativeStackScreenProps<AuthStackParams, 'SignIn'>;

export function SignInScreen({ navigation }: Props) {
  const signIn = useAuth((s) => s.signIn);
  const complete = useAuth((s) => s.complete);
  const [regNo, setRegNo] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(undefined);
    const res = await api.signIn(regNo, password);
    setBusy(false);
    if (!res.ok) return setError(res.error);
    signIn(regNo);
    complete('Student ' + regNo.trim().slice(-4)); // real name is pulled from the users table
  };

  return (
    <Screen scroll>
      <View style={s.header}>
        <Logo variant="lockup" height={36} />
      </View>
      <T kind="h1">Sign in</T>
      <T kind="caption">Your registration number is the login and the proof you belong on campus.</T>
      <View style={s.form}>
        <Field
          label="Registration number"
          placeholder="22BCE1234"
          autoCapitalize="characters"
          autoCorrect={false}
          value={regNo}
          onChangeText={setRegNo}
          error={error}
        />
        <Field label="Password" placeholder="••••••••" secureTextEntry value={password} onChangeText={setPassword} />
        <Button title="Sign in" onPress={submit} loading={busy} disabled={!regNo || !password} />
        <Button title="New here? Register" variant="ghost" onPress={() => navigation.navigate('Register')} />
      </View>
    </Screen>
  );
}

const s = StyleSheet.create({
  header: { alignItems: 'center', paddingVertical: space.xl },
  form: { gap: space.md, marginTop: space.sm },
});
