import { useQuery } from '@tanstack/react-query';
import { Text, View } from 'react-native';

import { apiFetch } from '@/lib/api';

export default function HomeScreen() {
  const { data, isPending, error } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiFetch<{ status: string }>('/health'),
  });

  return (
    <View className="flex-1 items-center justify-center gap-2 bg-white">
      <Text className="text-lg font-semibold">Home / Dashboard</Text>
      {isPending && <Text>Checking API...</Text>}
      {error && <Text className="text-red-500">API unreachable</Text>}
      {data && <Text className="text-green-600">API: {data.status}</Text>}
    </View>
  );
}
