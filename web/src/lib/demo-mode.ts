// Modo demo: build com `--mode demo` (pnpm dev:demo / pnpm build:demo). O app roda sem
// backend — apiFetch delega para a API falsa em src/demo/, com os dados no localStorage
// do visitante. Ver docs/web-architecture.md#modo-demo.
export const IS_DEMO = import.meta.env.MODE === 'demo';

export const DEMO_USER_NAME = 'Visitante';
