import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError, apiFetch } from '../lib/api';
import {
  hasRegisteredPasskey,
  markPasskeyRegistered,
  setToken,
} from '../lib/auth';
import {
  browserSupportsWebAuthn,
  loginWithPasskey,
  registerPasskey,
} from '../lib/webauthn';

export default function Login() {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offerPasskey, setOfferPasskey] = useState(false);

  const canUsePasskey = browserSupportsWebAuthn() && hasRegisteredPasskey();

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token } = await apiFetch<{ token: string }>('/auth/login', {
        method: 'POST',
        body: { password },
        skipAuth: true,
      });
      setToken(token);

      if (browserSupportsWebAuthn() && !hasRegisteredPasskey()) {
        setOfferPasskey(true);
      } else {
        navigate('/', { replace: true });
      }
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : 'Não foi possível entrar',
      );
    } finally {
      setLoading(false);
    }
  }

  async function handlePasskeyLogin() {
    setError(null);
    setLoading(true);
    try {
      const token = await loginWithPasskey();
      setToken(token);
      navigate('/', { replace: true });
    } catch {
      setError('Não foi possível entrar com Face ID/Touch ID');
    } finally {
      setLoading(false);
    }
  }

  async function handleRegisterPasskey() {
    try {
      await registerPasskey();
      markPasskeyRegistered();
    } catch {
      // registration is optional — a failure here shouldn't block getting into the app
    } finally {
      navigate('/', { replace: true });
    }
  }

  if (offerPasskey) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Ativar Face ID / Touch ID?</h1>
        <p className="text-sm text-neutral-500">
          Assim você não precisa digitar a senha nas próximas vezes.
        </p>
        <button
          onClick={handleRegisterPasskey}
          className="w-full max-w-xs rounded-lg bg-teal-700 px-4 py-3 text-white"
        >
          Ativar
        </button>
        <button
          onClick={() => navigate('/', { replace: true })}
          className="text-sm text-neutral-500"
        >
          Agora não
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6">
      <h1 className="text-xl font-semibold">Meu Dinheirinho</h1>
      <form
        onSubmit={handlePasswordLogin}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          className="rounded-lg border border-neutral-300 px-4 py-3"
          autoFocus
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-teal-700 px-4 py-3 text-white disabled:opacity-50"
        >
          Entrar
        </button>
      </form>
      {canUsePasskey && (
        <button
          onClick={handlePasskeyLogin}
          disabled={loading}
          className="text-sm text-teal-700"
        >
          Entrar com Face ID / Touch ID
        </button>
      )}
    </div>
  );
}
