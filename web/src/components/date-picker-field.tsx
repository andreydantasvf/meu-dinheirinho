import { useState } from 'react';
import { CalendarIcon } from 'lucide-react';
import { ptBR } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { formatDateFull } from '@/lib/date';

export function DatePickerField({
  id,
  value,
  onChange,
}: {
  id?: string;
  value: string;
  onChange: (iso: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const date = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          className="w-full justify-start font-normal"
        >
          <CalendarIcon className="size-4" />
          {date ? formatDateFull(value) : 'Selecione uma data'}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={date}
          locale={ptBR}
          onSelect={(selected) => {
            if (!selected) return;
            onChange(selected.toISOString());
            setOpen(false);
          }}
        />
      </PopoverContent>
    </Popover>
  );
}
