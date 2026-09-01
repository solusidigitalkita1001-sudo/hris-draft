import { useEffect, useMemo, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select2 } from '@/components/ui/select2';
import { popup, usePopupStore } from '@/stores/popup.store';
import { cn } from '@/utils/cn';

export function PopupHost() {
  const request = usePopupStore((state) => state.request);
  const [inputValue, setInputValue] = useState('');
  const [selectValue, setSelectValue] = useState('');

  useEffect(() => {
    if (!request) {
      setInputValue('');
      setSelectValue('');
      return;
    }

    if (request.kind === 'prompt') {
      setInputValue(request.defaultValue || '');
    } else if (request.kind === 'select') {
      setSelectValue(request.value || '');
    } else {
      setInputValue('');
      setSelectValue('');
    }
  }, [request]);

  const canConfirm = useMemo(() => {
    if (!request) return false;
    if (request.kind === 'prompt' && request.required) return Boolean(inputValue.trim());
    if (request.kind === 'select' && request.required) return Boolean(selectValue);
    return true;
  }, [inputValue, request, selectValue]);

  if (!request) return null;

  const isDestructive = request.intent === 'destructive';

  const handleConfirm = () => {
    if (request.kind === 'alert') {
      popup.resolve(undefined);
      return;
    }

    if (request.kind === 'confirm') {
      popup.resolve(true);
      return;
    }

    if (request.kind === 'prompt') {
      popup.resolve(inputValue.trim() ? inputValue.trim() : null);
      return;
    }

    popup.resolve(selectValue || null);
  };

  const handleCancel = () => {
    if (request.kind === 'confirm') {
      popup.resolve(false);
      return;
    }

    popup.resolve(null);
  };

  return (
    <Dialog.Root open onOpenChange={(open) => !open && handleCancel()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[80] bg-black/45 backdrop-blur-sm" />
        <Dialog.Content
          className={cn(
            'fixed left-1/2 top-1/2 z-[81] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card shadow-2xl',
            'focus:outline-none'
          )}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4">
            <div>
              <Dialog.Title className="text-base font-semibold">{request.title}</Dialog.Title>
              {request.description && (
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  {request.description}
                </Dialog.Description>
              )}
            </div>
            <button
              type="button"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              onClick={handleCancel}
              aria-label="Tutup dialog"
            >
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 px-5 py-4">
            {request.kind === 'prompt' && (
              <Input
                autoFocus
                value={inputValue}
                onChange={(event) => setInputValue(event.target.value)}
                placeholder={request.placeholder}
              />
            )}

            {request.kind === 'select' && (
              <Select2
                value={selectValue}
                onValueChange={setSelectValue}
                options={request.options}
                placeholder={request.placeholder || 'Pilih opsi'}
              />
            )}
          </div>

          <div className="flex justify-end gap-2 border-t border-border px-5 py-4">
            {request.kind !== 'alert' && (
              <Button type="button" variant="outline" onClick={handleCancel}>
                {request.cancelText || 'Batal'}
              </Button>
            )}
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!canConfirm}
              className={cn(isDestructive && 'bg-destructive text-destructive-foreground hover:bg-destructive/90')}
            >
              {request.confirmText || 'OK'}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
