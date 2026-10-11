import { env } from '../config/env';
import type { NotificationMessage } from './reminder-message';

const COR_ENTRADA = 0x16a34a;
const COR_SAIDA = 0xdc2626;

export const discordNotifier = {
  name: 'discord',

  isEnabled() {
    return Boolean(env.DISCORD_WEBHOOK_URL);
  },

  async send(message: NotificationMessage) {
    if (!env.DISCORD_WEBHOOK_URL) return;
    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'Meu Dinheirinho',
        embeds: [
          {
            title: message.title,
            description: message.body,
            color: message.tipo === 'ENTRADA' ? COR_ENTRADA : COR_SAIDA,
            ...(env.WEB_APP_URL && {
              url: new URL(message.path, env.WEB_APP_URL).toString(),
            }),
          },
        ],
      }),
    });
    if (!response.ok) {
      throw new Error(`Discord webhook respondeu ${response.status}`);
    }
  },
};
