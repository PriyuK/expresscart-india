import React, { useMemo } from 'react';
import { View, StyleSheet, Platform, TouchableOpacity } from 'react-native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Moon, Sun } from 'lucide-react-native';
import { useCartStore } from '../store/useCartStore';
import {
  ThemeColors,
  getThemeColors,
  FONTS,
  TYPOGRAPHY,
  ICON,
  TOUCH_TARGET,
} from '../theme/tokens';

export default function RootLayout() {
  const isDarkMode = useCartStore((s) => s.isDarkMode);
  const toggleDarkMode = useCartStore((s) => s.toggleDarkMode);
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
            headerRight: () => (
              <TouchableOpacity
                style={styles.headerThemeBtn}
                onPress={toggleDarkMode}
                activeOpacity={0.7}
                accessibilityRole="button"
                accessibilityLabel={
                  isDarkMode ? 'Switch to light mode' : 'Switch to dark mode'
                }
              >
                {isDarkMode ? (
                  <Sun
                    size={ICON.size}
                    color={COLORS.textPrimary}
                    strokeWidth={ICON.strokeWidth}
                  />
                ) : (
                  <Moon
                    size={ICON.size}
                    color={COLORS.textPrimary}
                    strokeWidth={ICON.strokeWidth}
                  />
                )}
              </TouchableOpacity>
            ),
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
    headerThemeBtn: {
      width: TOUCH_TARGET.min,
      height: TOUCH_TARGET.min,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
    },
  });
