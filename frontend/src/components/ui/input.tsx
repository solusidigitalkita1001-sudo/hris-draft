import * as React from 'react';
import { cn } from '@/utils/cn';
import { useI18n } from '@/i18n/provider';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const { t } = useI18n();
    const requiredMessage = t('wf.common.fieldRequired');
    const innerRef = React.useRef<HTMLInputElement | null>(null);

    const setRefs = React.useCallback(
      (node: HTMLInputElement | null) => {
        innerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) (ref as React.MutableRefObject<HTMLInputElement | null>).current = node;
      },
      [ref]
    );

    // Balon validasi bawaan browser berbahasa browser, bukan bahasa aplikasi:
    // "Please fill out this field." muncul di tengah UI berbahasa Indonesia.
    // Dipasang lewat listener native karena event `invalid` tidak merambat,
    // sehingga handler React di root tidak pernah menerimanya. Hanya kasus
    // field kosong yang ditimpa — pesan bawaan untuk format email/angka sudah
    // lebih spesifik daripada yang bisa ditulis di sini.
    React.useEffect(() => {
      const element = innerRef.current;
      if (!element) return;

      const handleInvalid = () => {
        if (element.validity.valueMissing) element.setCustomValidity(requiredMessage);
      };
      const handleInput = () => element.setCustomValidity('');

      element.addEventListener('invalid', handleInvalid);
      element.addEventListener('input', handleInput);
      return () => {
        element.removeEventListener('invalid', handleInvalid);
        element.removeEventListener('input', handleInput);
      };
    }, [requiredMessage]);

    return (
      <input
        type={type}
        className={cn(
          'flex h-10 w-full rounded-field border border-input bg-card px-3.5 py-1 text-sm shadow-card transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
          className
        )}
        ref={setRefs}
        {...props}
      />
    );
  }
);
Input.displayName = 'Input';

export { Input };
