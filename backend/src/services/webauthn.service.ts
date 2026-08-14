import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from '@simplewebauthn/server';
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from '@simplewebauthn/server';
import { env } from '../config/env';
import { currentUserName, issueToken } from '../lib/token';
import { webauthnRepository } from '../repositories/webauthn.repository';
import { AppError } from '../types/errors';

// Single-user MVP, single Node process — an in-memory challenge is enough, no session store needed.
let registrationChallenge: string | null = null;
let authenticationChallenge: string | null = null;

export const webauthnService = {
  async registerOptions() {
    const existing = await webauthnRepository.findFirst();

    const options = await generateRegistrationOptions({
      rpName: env.WEBAUTHN_RP_NAME,
      rpID: env.WEBAUTHN_RP_ID,
      userName: 'meu-dinheirinho',
      attestationType: 'none',
      excludeCredentials: existing ? [{ id: existing.credentialId }] : [],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform',
      },
    });

    registrationChallenge = options.challenge;
    return options;
  },

  async registerVerify(response: RegistrationResponseJSON) {
    if (!registrationChallenge) throw new AppError('Nenhum registro em andamento', 400);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: registrationChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
    });
    registrationChallenge = null;

    if (!verification.verified || !verification.registrationInfo) {
      throw new AppError('Não foi possível verificar o dispositivo', 400);
    }

    const { credential } = verification.registrationInfo;
    await webauthnRepository.create({
      credentialId: credential.id,
      publicKey: new Uint8Array(credential.publicKey),
      counter: BigInt(credential.counter),
    });

    return { registered: true };
  },

  async loginOptions() {
    const existing = await webauthnRepository.findFirst();
    if (!existing) throw new AppError('Nenhum dispositivo registrado', 404);

    const options = await generateAuthenticationOptions({
      rpID: env.WEBAUTHN_RP_ID,
      allowCredentials: [{ id: existing.credentialId }],
      userVerification: 'preferred',
    });

    authenticationChallenge = options.challenge;
    return options;
  },

  async loginVerify(response: AuthenticationResponseJSON) {
    if (!authenticationChallenge) throw new AppError('Nenhum login em andamento', 400);

    const credential = await webauthnRepository.findByCredentialId(response.id);
    if (!credential) throw new AppError('Dispositivo não reconhecido', 401);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: authenticationChallenge,
      expectedOrigin: env.WEBAUTHN_ORIGIN,
      expectedRPID: env.WEBAUTHN_RP_ID,
      credential: {
        id: credential.credentialId,
        publicKey: credential.publicKey,
        counter: Number(credential.counter),
      },
    });
    authenticationChallenge = null;

    if (!verification.verified) throw new AppError('Não foi possível verificar o dispositivo', 401);

    await webauthnRepository.updateCounter(
      credential.credentialId,
      BigInt(verification.authenticationInfo.newCounter)
    );

    return { token: issueToken(), name: currentUserName() };
  },
};
