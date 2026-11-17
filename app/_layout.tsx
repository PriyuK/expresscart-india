import React, { useMemo } from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useCartStore } from '../store/useCartStore';
import {
  ThemeColors,
  getThemeColors,
  FONTS,
  TYPOGRAPHY,
} from '../theme/tokens';

export default function RootLayout() {
  const isDarkMode = useCartStore((s) => s.isDarkMode);
  const COLORS = getThemeColors(isDarkMode);
  const styles = useMemo(() => createStyles(COLORS), [COLORS]);

  return (
    <View style={styles.outerBackdrop}>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
      <View style={styles.appFrame}>
        <Stack
          screenOptions={{
            headerStyle: {
              backgroundColor: COLORS.background,
            },
            headerTintColor: COLORS.textPrimary,
            headerTitleStyle: {
              fontFamily: FONTS.sans,
              fontWeight: TYPOGRAPHY.weightSemibold,
              fontSize: TYPOGRAPHY.bodySize,
              color: COLORS.textPrimary,
            },
            headerShadowVisible: false,
            contentStyle: { backgroundColor: COLORS.background },
          }}
        >
          <Stack.Screen
            name="index"
            options={{
              title: 'ExpressCart',
              headerShown: false,
            }}
          />
          <Stack.Screen
            name="auth"
            options={{
              title: 'Account',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="shop"
            options={{
              title: 'Scan items',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="checkout"
            options={{
              title: 'Checkout',
              headerBackTitle: 'Cart',
            }}
          />
          <Stack.Screen
            name="orders"
            options={{
              title: 'Passes & receipts',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="guard"
            options={{
              title: 'Store staff',
              headerBackTitle: 'Home',
            }}
          />
          <Stack.Screen
            name="legal"
            options={{
              title: 'Terms & privacy',
              headerBackTitle: 'Back',
            }}
          />
        </Stack>
      </View>
    </View>
  );
}

const createStyles = (COLORS: ThemeColors) =>
  StyleSheet.create({
    outerBackdrop: {
      flex: 1,
      backgroundColor: COLORS.pageBg,
      alignItems: 'center',
      justifyContent: 'center',
    },
    appFrame: {
      flex: 1,
      width: '100%',
      maxWidth: 480,
      backgroundColor: COLORS.background,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? {
            borderLeftWidth: 1,
            borderRightWidth: 1,
            borderColor: COLORS.divider,
          }
        : {}),
    },
  });
