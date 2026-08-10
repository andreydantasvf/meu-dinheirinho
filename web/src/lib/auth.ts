const TOKEN_KEY = 'authToken';
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

export function isLoggedIn(): boolean {
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
