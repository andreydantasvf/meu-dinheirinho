import { z } from 'zod';

// O backend faz POST para o endpoint salvo a cada disparo — só aceita os push
// services dos navegadores para não virar um proxy de requisições arbitrárias (SSRF).
const PUSH_HOSTS_EXATOS = ['fcm.googleapis.com', 'web.push.apple.com'];
const PUSH_HOSTS_SUFIXOS = [
  '.push.services.mozilla.com',
  '.notify.windows.com',
];

export function isEndpointDePushConhecido(endpoint: string): boolean {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  const host = url.hostname.toLowerCase().replace(/\.$/, '');
  return (
    url.protocol === 'https:' &&
    (PUSH_HOSTS_EXATOS.includes(host) ||
      PUSH_HOSTS_SUFIXOS.some((sufixo) => host.endsWith(sufixo)))
  );
}

// Formato de PushSubscription.toJSON() no navegador.
export const pushSubscriptionSchema = z.object({
  endpoint: z
    .url()
    .refine(isEndpointDePushConhecido, 'endpoint de push inválido'),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// Só apaga a linha do banco (nenhuma requisição sai daqui), então não restringe o host.
export const unsubscribeSchema = z.object({ endpoint: z.url() });

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;
