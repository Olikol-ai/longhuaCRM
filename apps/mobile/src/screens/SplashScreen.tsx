import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { BrandMark } from '../components/BrandMark';
import { colors } from '../theme/colors';

/**
 * In-app splash while auth bootstraps.
 * Native Expo splash (assets/splash-icon.png) covers cold start;
 * replace that asset when the branded splash is ready.
 */
export function SplashScreen() {
  return (
    <View style={styles.root}>
      <BrandMark size={96} />
      <Text style={styles.title}>Longhua Academy</Text>
      <Text style={styles.subtitle}>Образовательная платформа</Text>
      <ActivityIndicator color={colors.brand.gold} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.brand.red,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  title: {
    marginTop: 28,
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.3,
  },
  subtitle: {
    marginTop: 8,
    fontSize: 15,
    color: colors.brand.goldLight,
  },
  spinner: {
    marginTop: 40,
  },
});
