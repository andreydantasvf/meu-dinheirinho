import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen name="extrato" options={{ title: 'Extrato' }} />
      <Tabs.Screen name="cartoes" options={{ title: 'Cartões' }} />
      <Tabs.Screen name="categorias" options={{ title: 'Categorias' }} />
    </Tabs>
  );
}
