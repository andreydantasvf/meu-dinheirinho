import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { webauthnController } from '../controllers/webauthn.controller';
import { requireAuth } from '../middlewares/require-auth';

export const webauthnRoutes = Router();

const webauthnLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Tente novamente mais tarde.' },
});

// Registration only happens right after a password login, so it requires a valid token.
webauthnRoutes.post(
  '/register/options',
  requireAuth,
  webauthnController.registerOptions,
);
webauthnRoutes.post(
  '/register/verify',
  requireAuth,
  webauthnController.registerVerify,
);

// Login challenge/verify are public — this is how the user re-authenticates without a token.
webauthnRoutes.post(
  '/login/options',
  webauthnLimiter,
  webauthnController.loginOptions,
);
webauthnRoutes.post(
  '/login/verify',
  webauthnLimiter,
  webauthnController.loginVerify,
);
