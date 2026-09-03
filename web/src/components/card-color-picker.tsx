import { useController } from 'react-hook-form';
import type { Control, FieldValues, Path } from 'react-hook-form';
import { IconCheck } from '@tabler/icons-react';
import { BANK_COLOR_PRESETS } from '@/lib/card-colors';
import { cn } from '@/lib/utils';

export function CardColorPicker<T extends FieldValues>({
  control,
  name,
}: {
  control: Control<T>;
  name: Path<T>;
}) {
  const { field } = useController({ control, name });
  const selectedColorId = field.value || 'roxo';

  return (
    <div className="flex flex-wrap gap-2 pt-1">
      {BANK_COLOR_PRESETS.map((preset) => {
        const isSelected = selectedColorId === preset.id;
        return (
          <button
            key={preset.id}
            type="button"
            onClick={() => field.onChange(preset.id)}
            title={`${preset.name} (${preset.bankLabel})`}
            className={cn(
              'relative flex size-8 items-center justify-center rounded-full transition-transform active:scale-95',
              preset.swatchBg,
              isSelected
                ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-110'
                : 'opacity-85 hover:opacity-100 hover:scale-105',
            )}
          >
            {isSelected && (
              <IconCheck
                size={16}
                className="text-white drop-shadow"
                stroke={3}
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
