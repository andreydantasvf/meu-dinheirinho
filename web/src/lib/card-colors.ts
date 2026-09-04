export type BankColorPreset = {
  id: string;
  name: string;
  bankLabel: string;
  swatchBg: string;
  bg: string;
  border: string;
  accent: string;
  chip: string;
  glow: string;
  progressBar: string;
  circleLeft: string;
  circleRight: string;
};

export const BANK_COLOR_PRESETS: BankColorPreset[] = [
  {
    id: 'roxo',
    name: 'Roxo',
    bankLabel: 'Nubank',
    swatchBg: 'bg-purple-600',
    bg: 'bg-gradient-to-br from-purple-950 via-indigo-950 to-zinc-950',
    border: 'border-purple-500/30',
    accent: 'text-purple-400',
    chip: 'from-yellow-100 via-amber-300 to-yellow-400',
    glow: 'shadow-[0_12px_36px_rgba(168,85,247,0.22)]',
    progressBar: 'bg-purple-400 shadow-[0_0_12px_rgba(192,132,252,0.8)]',
    circleLeft: 'bg-purple-500/25',
    circleRight: 'bg-indigo-500/25',
  },
  {
    id: 'laranja',
    name: 'Laranja',
    bankLabel: 'Inter / BMG',
    swatchBg: 'bg-orange-500',
    bg: 'bg-gradient-to-br from-orange-950 via-zinc-950 to-amber-950',
    border: 'border-orange-500/30',
    accent: 'text-orange-400',
    chip: 'from-amber-200 via-yellow-400 to-amber-500',
    glow: 'shadow-[0_12px_36px_rgba(249,115,22,0.22)]',
    progressBar: 'bg-orange-400 shadow-[0_0_12px_rgba(251,146,60,0.8)]',
    circleLeft: 'bg-orange-500/25',
    circleRight: 'bg-amber-500/25',
  },
  {
    id: 'azul',
    name: 'Azul',
    bankLabel: 'Itaú / BTG / Caixa',
    swatchBg: 'bg-blue-600',
    bg: 'bg-gradient-to-br from-blue-950 via-slate-900 to-indigo-950',
    border: 'border-blue-500/30',
    accent: 'text-blue-400',
    chip: 'from-yellow-100 via-amber-300 to-yellow-500',
    glow: 'shadow-[0_12px_36px_rgba(59,130,246,0.22)]',
    progressBar: 'bg-blue-400 shadow-[0_0_12px_rgba(96,165,250,0.8)]',
    circleLeft: 'bg-blue-500/25',
    circleRight: 'bg-cyan-500/25',
  },
  {
    id: 'verde',
    name: 'Verde',
    bankLabel: 'Stone / Sicredi',
    swatchBg: 'bg-emerald-500',
    bg: 'bg-gradient-to-br from-emerald-950 via-teal-950 to-zinc-950',
    border: 'border-emerald-500/30',
    accent: 'text-emerald-400',
    chip: 'from-yellow-200 via-amber-300 to-yellow-500',
    glow: 'shadow-[0_12px_36px_rgba(16,185,129,0.2)]',
    progressBar: 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]',
    circleLeft: 'bg-emerald-500/25',
    circleRight: 'bg-teal-500/25',
  },
  {
    id: 'preto',
    name: 'Preto Black',
    bankLabel: 'C6 Black / XP',
    swatchBg: 'bg-zinc-800',
    bg: 'bg-gradient-to-br from-zinc-950 via-slate-900 to-black',
    border: 'border-cyan-500/30',
    accent: 'text-cyan-400',
    chip: 'from-amber-200 via-yellow-400 to-amber-500',
    glow: 'shadow-[0_12px_36px_rgba(6,182,212,0.18)]',
    progressBar: 'bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.8)]',
    circleLeft: 'bg-cyan-500/25',
    circleRight: 'bg-indigo-500/25',
  },
  {
    id: 'vermelho',
    name: 'Vermelho',
    bankLabel: 'Santander / Bradesco',
    swatchBg: 'bg-red-600',
    bg: 'bg-gradient-to-br from-rose-950 via-zinc-950 to-red-950',
    border: 'border-rose-500/30',
    accent: 'text-rose-400',
    chip: 'from-amber-100 via-yellow-300 to-amber-400',
    glow: 'shadow-[0_12px_36px_rgba(244,63,94,0.2)]',
    progressBar: 'bg-rose-400 shadow-[0_0_12px_rgba(251,113,133,0.8)]',
    circleLeft: 'bg-rose-500/25',
    circleRight: 'bg-amber-500/25',
  },
  {
    id: 'amarelo',
    name: 'Amarelo',
    bankLabel: 'Banco do Brasil',
    swatchBg: 'bg-yellow-500',
    bg: 'bg-gradient-to-br from-amber-950 via-stone-900 to-yellow-950',
    border: 'border-amber-500/30',
    accent: 'text-amber-400',
    chip: 'from-yellow-100 via-amber-300 to-yellow-400',
    glow: 'shadow-[0_12px_36px_rgba(245,158,11,0.22)]',
    progressBar: 'bg-amber-400 shadow-[0_0_12px_rgba(251,191,36,0.8)]',
    circleLeft: 'bg-amber-500/25',
    circleRight: 'bg-yellow-500/25',
  },
];

const STORAGE_KEY = 'meudinteirinho_card_colors';

export function getCardColorMap(): Record<string, string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function getCardColorId(accountId: string, accountName: string): string {
  const map = getCardColorMap();
  if (map[accountId]) return map[accountId];

  // Deterministic fallback based on account name/id hash
  let hash = 0;
  const str = accountId + accountName;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return BANK_COLOR_PRESETS[Math.abs(hash) % BANK_COLOR_PRESETS.length].id;
}

export function getCardTheme(
  accountId: string,
  accountName: string,
): BankColorPreset {
  const colorId = getCardColorId(accountId, accountName);
  return (
    BANK_COLOR_PRESETS.find((p) => p.id === colorId) ?? BANK_COLOR_PRESETS[0]
  );
}

export function setCardColorId(accountId: string, colorId: string) {
  try {
    const map = getCardColorMap();
    map[accountId] = colorId;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
    window.dispatchEvent(new Event('card-colors-changed'));
  } catch {
    // LocalStorage write failed
  }
}
