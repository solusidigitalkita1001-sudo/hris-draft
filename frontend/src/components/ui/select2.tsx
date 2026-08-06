import * as SelectPrimitive from '@radix-ui/react-select';
import { Check, ChevronDown } from 'lucide-react';
import { cn } from '@/utils/cn';

const EMPTY_VALUE = '__select2-empty__';

export interface Select2Option {
  value: string;
  label: string;
  disabled?: boolean;
}

interface Select2Props {
  value?: string;
  onValueChange: (value: string) => void;
  options: Select2Option[];
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  contentClassName?: string;
}

function normalizeValue(value?: string) {
  if (value === undefined) return undefined;
  return value === '' ? EMPTY_VALUE : value;
}

function denormalizeValue(value: string) {
  return value === EMPTY_VALUE ? '' : value;
}

export function Select2({
  value,
  onValueChange,
  options,
  placeholder = 'Pilih opsi',
  disabled,
  className,
  contentClassName,
}: Select2Props) {
  return (
    <SelectPrimitive.Root
      value={normalizeValue(value)}
      onValueChange={(nextValue) => onValueChange(denormalizeValue(nextValue))}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        className={cn(
          'flex h-10 w-full items-center justify-between rounded-lg border border-input bg-background px-3 text-sm text-foreground shadow-sm transition-colors',
          'focus:outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown size={16} className="text-muted-foreground" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={6}
          className={cn(
            'z-[90] max-h-80 min-w-[12rem] overflow-hidden rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-xl',
            contentClassName
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((option) => (
              <SelectPrimitive.Item
                key={`${option.value || EMPTY_VALUE}-${option.label}`}
                value={normalizeValue(option.value) || EMPTY_VALUE}
                disabled={option.disabled}
                className={cn(
                  'relative flex cursor-pointer select-none items-center rounded-lg py-2 pl-3 pr-9 text-sm outline-none transition-colors',
                  'focus:bg-muted data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary',
                  'data-[disabled]:pointer-events-none data-[disabled]:opacity-50'
                )}
              >
                <SelectPrimitive.ItemText>{option.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-3 inline-flex items-center text-primary">
                  <Check size={14} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  );
}
