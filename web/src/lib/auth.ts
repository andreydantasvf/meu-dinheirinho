import { DEMO_USER_NAME, IS_DEMO } from './demo-mode';

const TOKEN_KEY = 'authToken';
const NAME_KEY = 'userName';
const WEBAUTHN_KEY = 'webauthnRegistered';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUserName(): string | null {
  if (IS_DEMO) return DEMO_USER_NAME;
  return localStorage.getItem(NAME_KEY);
}

export function setUserName(name: string): void {
  localStorage.setItem(NAME_KEY, name);
}

export function clearUserName(): void {
  localStorage.removeItem(NAME_KEY);
}

// Na demo não existe backend nem senha: o visitante entra direto.
export function isLoggedIn(): boolean {
  if (IS_DEMO) return true;
  return getToken() !== null;
}

// Local heuristic only: a device that registered a passkey remembers it here so Login can
// offer the "usar Face ID" button without a server round-trip. If storage is cleared, the
// server-side credential still exists but this flag needs re-registering to reappear.
export function hasRegisteredPasskey(): boolean {
  return localStorage.getItem(WEBAUTHN_KEY) === 'true';
}

export function markPasskeyRegistered(): void {
  localStorage.setItem(WEBAUTHN_KEY, 'true');
}
