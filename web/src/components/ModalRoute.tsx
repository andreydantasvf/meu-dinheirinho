import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

export function ModalRoute({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-white pt-[env(safe-area-inset-top)]">
      <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
        <h1 className="text-lg font-semibold">{title}</h1>
        <button
          onClick={() => navigate(-1)}
          className="text-sm text-neutral-500"
        >
          Fechar
        </button>
      </header>
      <div className="flex-1 overflow-y-auto p-4">{children}</div>
    </div>
  );
}
