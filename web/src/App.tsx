import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuth } from './components/RequireAuth';
import { Toaster } from '@/components/ui/sonner';
import { PwaUpdatePrompt } from './components/PwaUpdatePrompt';
import Login from './routes/Login';
import TabsLayout from './routes/TabsLayout';
import Home from './routes/Home';
import Extrato from './routes/Extrato';
import Cartoes from './routes/Cartoes';
import Categorias from './routes/Categorias';
import NovaTransacao from './routes/NovaTransacao';
import NovaCompraParcelada from './routes/NovaCompraParcelada';

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route element={<RequireAuth />}>
          <Route element={<TabsLayout />}>
            <Route index element={<Home />} />
            <Route path="extrato" element={<Extrato />} />
            <Route path="cartoes" element={<Cartoes />} />
            <Route path="categorias" element={<Categorias />} />
          </Route>
          <Route path="transacoes/nova" element={<NovaTransacao />} />
          <Route path="transacoes/:id" element={<NovaTransacao />} />
          <Route path="compras/nova" element={<NovaCompraParcelada />} />
          <Route path="compras/:id" element={<NovaCompraParcelada />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <Toaster position="top-center" />
      <PwaUpdatePrompt />
    </>
  );
}
