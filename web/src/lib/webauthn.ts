import {
  browserSupportsWebAuthn,
  startAuthentication,
  startRegistration,
  type PublicKeyCredentialCreationOptionsJSON,
  type PublicKeyCredentialRequestOptionsJSON,
} from '@simplewebauthn/browser';
import { apiFetch } from './api';

export { browserSupportsWebAuthn };

export async function registerPasskey(): Promise<void> {
  const options = await apiFetch<PublicKeyCredentialCreationOptionsJSON>(
    '/auth/webauthn/register/options',
    {
      method: 'POST',
    },
  );
  const attestation = await startRegistration({ optionsJSON: options });
  await apiFetch('/auth/webauthn/register/verify', {
    method: 'POST',
    body: attestation,
  });
}

export async function loginWithPasskey(): Promise<string> {
  const options = await apiFetch<PublicKeyCredentialRequestOptionsJSON>(
    '/auth/webauthn/login/options',
    {
      method: 'POST',
      skipAuth: true,
    },
  );
  const assertion = await startAuthentication({ optionsJSON: options });
  const { token } = await apiFetch<{ token: string }>(
    '/auth/webauthn/login/verify',
    {
      method: 'POST',
      body: assertion,
      skipAuth: true,
    },
  );
  return token;
}
