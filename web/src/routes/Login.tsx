import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { IconEye, IconEyeOff, IconFingerprint } from '@tabler/icons-react';
import { ApiError, apiFetch } from '../lib/api';
import {
  hasRegisteredPasskey,
  markPasskeyRegistered,
  setToken,
  setUserName,
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
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [offerPasskey, setOfferPasskey] = useState(false);

  const canUsePasskey = browserSupportsWebAuthn() && hasRegisteredPasskey();

  async function handlePasswordLogin(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { token, name } = await apiFetch<{ token: string; name: string }>('/auth/login', {
        method: 'POST',
        body: { password },
        skipAuth: true,
      });
      setToken(token);
      setUserName(name);

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
      const { token, name } = await loginWithPasskey();
      setToken(token);
      setUserName(name);
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
      // registration is optional
    } finally {
      navigate('/', { replace: true });
    }
  }

  if (offerPasskey) {
    return (
      <div className="flex min-h-dvh max-w-md mx-auto flex-col items-center justify-center gap-6 bg-background p-6 text-center text-foreground">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 border border-primary/30 text-primary">
          <IconFingerprint size={36} />
        </div>
        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Ativar Biometria?</h1>
          <p className="text-sm text-muted-foreground max-w-xs">
            Ative o Face ID / Touch ID para acessar seu aplicativo instantaneamente nas próximas vezes.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-3">
          <Button
            onClick={handleRegisterPasskey}
            className="h-13 w-full rounded-xl bg-primary font-bold text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 text-base"
          >
            Ativar Biometria
          </Button>
          <Button
            variant="ghost"
            onClick={() => navigate('/', { replace: true })}
            className="text-muted-foreground hover:text-foreground"
          >
            Agora não
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-dvh max-w-md mx-auto flex-col items-center justify-center gap-8 bg-background px-8 text-foreground">
      {/* Brand Emblem */}
      <div className="flex flex-col items-center gap-4">
        <div className="flex size-20 items-center justify-center rounded-3xl bg-gradient-to-br from-card to-background border border-primary/35 font-extrabold text-3xl tracking-tight text-primary shadow-[0_0_48px_rgba(0,200,255,0.25)]">
          MD
        </div>
        <div className="text-center">
          <h1 className="text-3xl font-extrabold tracking-tight">Meu Dinheirinho</h1>
          <p className="text-xs font-semibold tracking-[0.25em] text-primary/80 uppercase mt-1">
            Controle Pessoal
          </p>
        </div>
      </div>

      {/* Password Form */}
      <form onSubmit={handlePasswordLogin} className="flex w-full max-w-xs flex-col gap-4">
        <div className="flex flex-col gap-2">
          <label htmlFor="senha" className="text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Senha
          </label>
          <div className="relative">
            <Input
              id="senha"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoFocus
              className="h-13 rounded-xl border-primary/50 bg-card px-4 pr-12 text-base text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:ring-4 focus:ring-primary/20"
            />
            <button
              type="button"
              onClick={() => setShowPassword((show) => !show)}
              aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground/70 hover:text-foreground"
            >
              {showPassword ? <IconEyeOff size={20} /> : <IconEye size={20} />}
            </button>
          </div>
        </div>

        {error && <p className="text-center text-sm font-medium text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={loading}
          className="h-13 w-full rounded-xl bg-primary font-bold text-base text-primary-foreground shadow-[0_0_24px_rgba(0,200,255,0.35)] hover:bg-primary/90 transition-all active:scale-[0.98]"
        >
          {loading ? 'Entrando...' : 'Entrar'}
        </Button>
      </form>

      {/* Biometrics option */}
      {canUsePasskey && (
        <div className="flex w-full max-w-xs flex-col items-center gap-4">
          <div className="flex w-full items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs font-medium text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="h-13 w-full gap-3 rounded-xl border-border bg-transparent font-semibold text-foreground hover:bg-foreground/5"
          >
            <IconFingerprint size={22} className="text-primary" />
            Entrar com Face ID
          </Button>
        </div>
      )}
    </div>
  );
}
