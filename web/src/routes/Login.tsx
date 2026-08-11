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
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

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
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-center text-foreground">
        <h1 className="text-xl font-semibold">Ativar Face ID / Touch ID?</h1>
        <p className="text-sm text-muted-foreground">
          Assim você não precisa digitar a senha nas próximas vezes.
        </p>
        <Button
          onClick={handleRegisterPasskey}
          className="w-full max-w-xs"
          size="lg"
        >
          Ativar
        </Button>
        <Button
          variant="ghost"
          onClick={() => navigate('/', { replace: true })}
          className="text-muted-foreground"
        >
          Agora não
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-6 text-foreground">
      <h1 className="text-xl font-semibold">Meu Dinheirinho</h1>
      <form
        onSubmit={handlePasswordLogin}
        className="flex w-full max-w-xs flex-col gap-3"
      >
        <Input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Senha"
          autoFocus
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" disabled={loading} size="lg">
          Entrar
        </Button>
      </form>
      {canUsePasskey && (
        <Button
          variant="link"
          onClick={handlePasskeyLogin}
          disabled={loading}
          className="text-primary"
        >
          Entrar com Face ID / Touch ID
        </Button>
      )}
    </div>
  );
}
