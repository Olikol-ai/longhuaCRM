import React, { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '../auth/useAuth';
import { BrandMark } from '../components/BrandMark';
import { useTheme } from '../theme/ThemeProvider';
import { colors } from '../theme/colors';

export function LoginScreen() {
  const { signIn } = useAuth();
  const { theme } = useTheme();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    setError(null);
    if (!email.trim() || !password) {
      setError('Введите email и пароль');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
    } catch {
      setError('Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <View style={styles.content}>
          <View style={styles.hero}>
            <BrandMark size={72} />
            <Text style={[styles.title, { color: theme.text }]}>Longhua Academy</Text>
            <Text style={[styles.caption, { color: theme.textMuted }]}>
              Вход для учеников и преподавателей
            </Text>
          </View>

          <View
            style={[
              styles.card,
              { backgroundColor: theme.surface, borderColor: theme.border },
            ]}
          >
            <Text style={[styles.label, { color: theme.textMuted }]}>Email</Text>
            <TextInput
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              placeholder="you@example.com"
              placeholderTextColor={theme.textMuted}
              value={email}
              onChangeText={setEmail}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />

            <Text style={[styles.label, { color: theme.textMuted }]}>Пароль</Text>
            <TextInput
              secureTextEntry
              placeholder="••••••••"
              placeholderTextColor={theme.textMuted}
              value={password}
              onChangeText={setPassword}
              style={[
                styles.input,
                {
                  color: theme.text,
                  borderColor: theme.border,
                  backgroundColor: theme.background,
                },
              ]}
            />

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <Pressable
              accessibilityRole="button"
              disabled={submitting}
              onPress={() => void handleSubmit()}
              style={({ pressed }) => [
                styles.button,
                { opacity: pressed || submitting ? 0.85 : 1 },
              ]}
            >
              {submitting ? (
                <ActivityIndicator color="#FFFFFF" />
              ) : (
                <Text style={styles.buttonText}>Войти</Text>
              )}
            </Pressable>

            <Text style={[styles.hint, { color: theme.textMuted }]}>
              Пока без API: любой email и пароль откроют приложение (токен в SecureStore).
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 28,
  },
  hero: { alignItems: 'center', gap: 10 },
  title: { fontSize: 26, fontWeight: '700', marginTop: 8 },
  caption: { fontSize: 14, textAlign: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 20,
    gap: 8,
  },
  label: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
  },
  error: { color: colors.brand.redLight, fontSize: 13, marginTop: 4 },
  button: {
    marginTop: 12,
    backgroundColor: colors.brand.red,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderBottomWidth: 3,
    borderBottomColor: colors.brand.gold,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
  hint: { marginTop: 12, fontSize: 12, lineHeight: 18, textAlign: 'center' },
});
