import '../global.css';

import { QueryClientProvider } from '@tanstack/react-query';
import { Stack } from 'expo-router';

import { queryClient } from '@/lib/query-client';

export default function RootLayout() {
  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="nova-transacao"
          options={{ presentation: 'modal', title: 'Nova transação' }}
        />
        <Stack.Screen
          name="nova-compra-parcelada"
          options={{ presentation: 'modal', title: 'Nova compra parcelada' }}
        />
      </Stack>
    </QueryClientProvider>
  );
}
