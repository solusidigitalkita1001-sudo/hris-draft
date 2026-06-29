import { create } from 'zustand';
import type { Select2Option } from '@/components/ui/select2';

type PopupIntent = 'default' | 'destructive';

interface PopupBase {
  title: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  intent?: PopupIntent;
}

interface AlertPopup extends PopupBase {
  kind: 'alert';
}

interface ConfirmPopup extends PopupBase {
  kind: 'confirm';
}

interface PromptPopup extends PopupBase {
  kind: 'prompt';
  defaultValue?: string;
  placeholder?: string;
  required?: boolean;
}

interface SelectPopup extends PopupBase {
  kind: 'select';
  value?: string;
  placeholder?: string;
  options: Select2Option[];
  required?: boolean;
}

export type PopupRequest = AlertPopup | ConfirmPopup | PromptPopup | SelectPopup;

interface PopupState {
  request: PopupRequest | null;
  open: (request: PopupRequest) => void;
  close: () => void;
}

export const usePopupStore = create<PopupState>((set) => ({
  request: null,
  open: (request) => set({ request }),
  close: () => set({ request: null }),
}));

let activeResolver: ((value: unknown) => void) | null = null;

function resolvePopup(value: unknown) {
  activeResolver?.(value);
  activeResolver = null;
  usePopupStore.getState().close();
}

function openPopup<T>(request: PopupRequest, fallbackValue: T) {
  return new Promise<T>((resolve) => {
    activeResolver = (value) => resolve((value as T) ?? fallbackValue);
    usePopupStore.getState().open(request);
  });
}

export const popup = {
  alert(config: Omit<AlertPopup, 'kind'>) {
    return openPopup<void>(
      {
        kind: 'alert',
        confirmText: 'Tutup',
        ...config,
      },
      undefined
    );
  },
  confirm(config: Omit<ConfirmPopup, 'kind'>) {
    return openPopup<boolean>(
      {
        kind: 'confirm',
        confirmText: 'Ya',
        cancelText: 'Batal',
        ...config,
      },
      false
    );
  },
  prompt(config: Omit<PromptPopup, 'kind'>) {
    return openPopup<string | null>(
      {
        kind: 'prompt',
        confirmText: 'Simpan',
        cancelText: 'Batal',
        ...config,
      },
      null
    );
  },
  select(config: Omit<SelectPopup, 'kind'>) {
    return openPopup<string | null>(
      {
        kind: 'select',
        confirmText: 'Pilih',
        cancelText: 'Batal',
        ...config,
      },
      null
    );
  },
  resolve: resolvePopup,
};
