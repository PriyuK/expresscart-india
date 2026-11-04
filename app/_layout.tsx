import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: '#FFFFFF' },
          headerTintColor: '#09090B',
          headerTitleStyle: { fontWeight: '600', fontSize: 15 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#FAFAFA' },
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
            title: 'Shopper Verification & Wallet',
            headerBackTitle: 'Home',
          }}
        />
        <Stack.Screen
          name="shop"
          options={{
            title: 'Cart Handlebar Scanner',
            headerBackTitle: 'Home',
          }}
        />
        <Stack.Screen
          name="checkout"
          options={{
            title: 'Order Summary & Self-Checkout',
            headerBackTitle: 'Basket',
          }}
        />
        <Stack.Screen
          name="guard"
          options={{
            title: 'Exit Gate Verification Terminal',
            headerBackTitle: 'Home',
          }}
        />
      </Stack>
    </>
  );
}
