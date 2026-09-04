import { useController } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { MoneyInput } from './money-input';
import { DatePickerField } from './date-picker-field';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

export function ControlledMoneyInput<T extends FieldValues>({
  control,
  name,
  className,
}: {
  control: Control<T>;
  name: Path<T>;
  className?: string;
}) {
  const { field } = useController({ control, name });
  return (
    <MoneyInput
      id={name}
      value={field.value ?? '0.00'}
      onChange={field.onChange}
      className={className}
    />
  );
}

export function ControlledHeroMoneyInput<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) {
  const { field } = useController({ control, name });
  return (
    <div className="flex items-baseline justify-center gap-1 max-w-full">
      <span className="text-2xl font-bold text-muted-foreground">R$</span>
      <MoneyInput
        id={name}
        value={field.value}
        onChange={field.onChange}
        className="h-auto border-none bg-transparent p-0 text-primary text-4xl font-extrabold tracking-tight tabular-nums focus-visible:ring-0 w-auto text-center"
      />
    </div>
  );
}

export function ControlledDatePicker<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) {
  const { field } = useController({ control, name });
  return (
    <DatePickerField id={name} value={field.value} onChange={field.onChange} />
  );
}

export function ControlledSelect<T extends FieldValues>({
  control,
  name,
  placeholder,
  options,
}: {
  control: Control<T>;
  name: Path<T>;
  placeholder?: string;
  options: Array<{ value: string; label: string }>;
}) {
  const { field } = useController({ control, name });
  const selectedLabel = options.find(
    (option) => option.value === field.value,
  )?.label;
  return (
    <Select value={field.value} onValueChange={field.onChange}>
      <SelectTrigger
        id={name}
        className="w-full h-12 rounded-xl border-border bg-card text-sm text-foreground"
      >
        <SelectValue placeholder={placeholder}>{selectedLabel}</SelectValue>
      </SelectTrigger>
      <SelectContent>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
