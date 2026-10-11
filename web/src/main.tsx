import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import App from './App';
import { queryClient, persister, CACHE_BUSTER } from './lib/query-client';
import { ThemeProvider } from './components/theme-provider';
import { IS_DEMO } from './lib/demo-mode';
import './index.css';

if (IS_DEMO) {
  document.title = 'Meu Dinheirinho (demo)';
  document
    .querySelector('meta[name="description"]')
    ?.setAttribute(
      'content',
      'Demo interativa do Meu Dinheirinho, com dados fictícios salvos só no seu navegador.',
    );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister,
          maxAge: 1000 * 60 * 60 * 24,
          buster: CACHE_BUSTER,
        }}
      >
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PersistQueryClientProvider>
    </ThemeProvider>
  </StrictMode>,
);
