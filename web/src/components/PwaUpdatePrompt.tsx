import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { toast } from 'sonner';

// Installed PWAs stay open for long stretches without a full page navigation,
// so the browser's default SW update check (which fires on registration/navigation)
// may never run. Poll manually so a new deploy is picked up while the app is open.
const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;

export function PwaUpdatePrompt() {
  const { needRefresh, updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_url, registration) {
      if (!registration) return;
      setInterval(() => registration.update(), UPDATE_CHECK_INTERVAL_MS);
    },
  });

  const [isNeedRefresh] = needRefresh;

  useEffect(() => {
    if (!isNeedRefresh) return;

    toast('Nova versão disponível', {
      id: 'pwa-update',
      description: 'Recarregue para aplicar as atualizações.',
      duration: Infinity,
      action: {
        label: 'Recarregar',
        onClick: () => updateServiceWorker(true),
      },
    });
  }, [isNeedRefresh, updateServiceWorker]);

  return null;
}
