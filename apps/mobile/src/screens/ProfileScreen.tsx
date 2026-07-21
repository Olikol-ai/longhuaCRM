import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useAuth } from '../auth/useAuth';
import { useTheme } from '../theme/ThemeProvider';
import { colors } from '../theme/colors';
import { getApiBaseUrl } from '../api/client';

export function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { theme, mode, toggleMode } = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <View
        style={[
          styles.card,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        <Text style={[styles.title, { color: theme.text }]}>Профиль</Text>
        <Text style={[styles.row, { color: theme.text }]}>
          {user ? `${user.firstName} ${user.lastName}` : '—'}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>{user?.email ?? '—'}</Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          Роль: {user?.role ?? '—'}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>
          API: {getApiBaseUrl()}
        </Text>
        <Text style={[styles.meta, { color: theme.textMuted }]}>Тема: {mode}</Text>

        <Pressable
          accessibilityRole="button"
          onPress={toggleMode}
          style={[styles.secondaryBtn, { borderColor: colors.brand.gold }]}
        >
          <Text style={[styles.secondaryText, { color: theme.text }]}>
            Переключить тему
          </Text>
        </Pressable>

        <Pressable
          accessibilityRole="button"
          onPress={() => void signOut()}
          style={styles.logoutBtn}
        >
          <Text style={styles.logoutText}>Выйти</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, padding: 20, justifyContent: 'center' },
  card: { borderWidth: 1, borderRadius: 16, padding: 24, gap: 6 },
  title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
  row: { fontSize: 18, fontWeight: '600' },
  meta: { fontSize: 14, lineHeight: 20 },
  secondaryBtn: {
    marginTop: 16,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  secondaryText: { fontWeight: '600' },
  logoutBtn: {
    marginTop: 10,
    backgroundColor: colors.brand.red,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  logoutText: { color: '#FFFFFF', fontWeight: '700' },
});
