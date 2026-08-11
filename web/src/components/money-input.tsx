import type { ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { centsToApiString, formatMoney } from '@/lib/money';

export function MoneyInput({
  id,
  value,
  onChange,
  className,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}) {
  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, '');
    onChange(centsToApiString(digits === '' ? 0 : Number(digits)));
  }

  return (
    <Input
      id={id}
      inputMode="numeric"
      value={formatMoney(value || '0')}
      onChange={handleChange}
      className={className}
    />
  );
}
