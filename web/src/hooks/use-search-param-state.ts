import { useSearchParams } from 'react-router-dom';

// Estado de tela (mês, filtros) guardado na query string em vez de useState: as
// rotas modais (/transacoes/:id, /compras/:id) ficam fora do TabsLayout, então a
// tela desmonta ao abrir um lançamento e o useState voltaria ao padrão. O valor
// padrão não vai para a URL, e trocar de valor substitui a entrada do histórico.
export function useSearchParamState<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string) => value is T,
): [T, (next: T) => void] {
  const [params, setParams] = useSearchParams();
  const raw = params.get(key);
  const value = raw !== null && isValid(raw) ? raw : defaultValue;

  function setValue(next: T) {
    if (next === value) return;
    setParams(
      (prev) => {
        const nextParams = new URLSearchParams(prev);
        if (next === defaultValue) nextParams.delete(key);
        else nextParams.set(key, next);
        return nextParams;
      },
      { replace: true },
    );
  }

  return [value, setValue];
}

export function isMonth(value: string): value is string {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(value);
}

export function isNonEmpty(value: string): value is string {
  return value.length > 0;
}
