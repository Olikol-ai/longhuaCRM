import React from 'react';
import { View } from 'react-native';
import { colors } from '../theme/colors';

type BrandMarkProps = {
  size?: number;
};

/**
 * Temporary brand mark for Longhua Academy (no letter "L").
 * Replace with branded asset when design is ready.
 */
export function BrandMark({ size = 88 }: BrandMarkProps) {
  const ring = Math.round(size * 0.12);
  const inner = Math.round(size * 0.42);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="Longhua Academy"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: colors.brand.red,
        borderWidth: ring,
        borderColor: colors.brand.gold,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View
        style={{
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: colors.brand.gold,
          opacity: 0.95,
        }}
      />
    </View>
  );
}
