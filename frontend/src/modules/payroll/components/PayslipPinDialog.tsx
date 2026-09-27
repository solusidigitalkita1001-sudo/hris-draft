import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { Delete, KeyRound, LockKeyhole } from 'lucide-react';
import { AppModal } from '@/components/shared/AppModal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { payrollService, type PayslipUnlockGrant } from '@/services/payroll.service';
import { apiErrorMessage, apiErrorStatus } from '@/lib/errors';
import { formatDateTime } from '@/utils/format';

const PIN_LENGTH = 6;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '').slice(0, PIN_LENGTH);
}

/**
 * Input PIN 6 digit dengan indikator dot: satu input numerik tersembunyi yang
 * tetap fokusable/aksesibel, divisualkan sebagai 6 kotak berisi dot.
 */
function PinInput({
  label,
  value,
  onChange,
  autoFocus,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (next: string) => void;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [focused, setFocused] = useState(false);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-3">
        <label className="block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">
          {label}
        </label>
        <button
          type="button"
          tabIndex={-1}
          onClick={() => {
            onChange('');
            inputRef.current?.focus();
          }}
          disabled={disabled || value.length === 0}
          className="inline-flex items-center gap-1 text-[10.5px] font-medium text-muted-foreground transition-colors hover:text-danger disabled:pointer-events-none disabled:opacity-40"
        >
          <Delete size={12} /> Hapus
        </button>
      </div>
      <div
        className="relative"
        onClick={() => inputRef.current?.focus()}
      >
        <input
          ref={inputRef}
          type="password"
          inputMode="numeric"
          autoComplete="off"
          pattern="[0-9]*"
          maxLength={PIN_LENGTH}
          aria-label={label}
          value={value}
          disabled={disabled}
          autoFocus={autoFocus}
          onChange={(e) => onChange(onlyDigits(e.target.value))}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
        />
        <div className="pointer-events-none flex justify-between gap-2" aria-hidden="true">
          {Array.from({ length: PIN_LENGTH }).map((_, i) => {
            const filled = i < value.length;
            const active = focused && i === Math.min(value.length, PIN_LENGTH - 1) && value.length < PIN_LENGTH;
            return (
              <span
                key={i}
                className={`flex h-12 w-full max-w-[52px] items-center justify-center rounded-field border bg-background text-lg font-semibold text-foreground transition-colors ${
                  active ? 'border-primary ring-2 ring-primary/25' : filled ? 'border-primary/50' : 'border-border'
                }`}
              >
                {filled ? '•' : ''}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Dialog PIN slip gaji — dua mode:
 * - mode "set": atur/ubah PIN (verifikasi password akun + PIN baru 2x).
 * - mode "unlock": masukkan PIN untuk membuka nominal (token unlock 15 menit,
 *   disimpan pemanggil di state memory saja).
 */
export function PayslipPinDialog({
  open,
  mode,
  pinAlreadySet,
  lockedUntil,
  onClose,
  onPinSaved,
  onUnlocked,
}: {
  open: boolean;
  mode: 'set' | 'unlock';
  /** Untuk judul mode "set": Atur vs Ubah. */
  pinAlreadySet?: boolean;
  /** ISO datetime saat lockout percobaan PIN berakhir (dari status server). */
  lockedUntil?: string;
  onClose: () => void;
  onPinSaved?: () => void;
  onUnlocked?: (grant: PayslipUnlockGrant) => void;
}) {
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Bersihkan semua rahasia setiap kali dialog dibuka/ditutup.
  useEffect(() => {
    setPassword('');
    setPin('');
    setPinConfirm('');
    setError(null);
    setSubmitting(false);
  }, [open, mode]);

  const isLockedNow = Boolean(lockedUntil && Date.parse(lockedUntil) > Date.now());

  const handleSetPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) return setError('PIN harus 6 digit angka');
    if (pin !== pinConfirm) return setError('Konfirmasi PIN tidak sama');
    setSubmitting(true);
    setError(null);
    try {
      await payrollService.setPayslipPin(password, pin);
      toast.success(pinAlreadySet ? 'PIN slip gaji berhasil diubah' : 'PIN slip gaji berhasil diatur');
      onPinSaved?.();
      onClose();
    } catch (err) {
      setError(apiErrorMessage(err, 'Gagal menyimpan PIN'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (pin.length !== PIN_LENGTH) return setError('Masukkan 6 digit PIN');
    setSubmitting(true);
    setError(null);
    try {
      const grant = await payrollService.unlockMyPayslips(pin);
      toast.success('Nominal slip gaji terbuka');
      onUnlocked?.(grant);
      onClose();
    } catch (err) {
      setPin('');
      const status = apiErrorStatus(err);
      setError(apiErrorMessage(err, status === 429 ? 'Terlalu banyak percobaan. Coba lagi nanti.' : 'PIN salah'));
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'set') {
    return (
      <AppModal
        open={open}
        onClose={onClose}
        title={pinAlreadySet ? 'Ubah PIN Slip Gaji' : 'Atur PIN Slip Gaji'}
        description="PIN 6 digit dibutuhkan untuk membuka nominal slip gaji Anda. Verifikasi dengan kata sandi akun terlebih dahulu."
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSetPin} className="space-y-5">
          <div>
            <label className="mb-2 block text-[10.5px] font-semibold uppercase tracking-[1px] text-muted-foreground">
              Kata sandi akun
            </label>
            <Input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoFocus
            />
          </div>
          <PinInput label="PIN baru (6 digit)" value={pin} onChange={setPin} />
          <PinInput label="Ulangi PIN baru" value={pinConfirm} onChange={setPinConfirm} />
          {error && <p className="text-xs font-medium text-danger">{error}</p>}
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Jangan gunakan angka yang mudah ditebak (tanggal lahir, 123456). PIN disimpan
            terenkripsi di server dan tidak pernah ditampilkan kembali.
          </p>
          <div className="flex justify-end gap-2.5">
            <Button type="button" variant="outline" size="sm" onClick={onClose}>
              Batal
            </Button>
            <Button type="submit" size="sm" disabled={submitting || !password || pin.length !== PIN_LENGTH || pinConfirm.length !== PIN_LENGTH}>
              <KeyRound size={14} className="mr-1.5" />
              {submitting ? 'Menyimpan...' : 'Simpan PIN'}
            </Button>
          </div>
        </form>
      </AppModal>
    );
  }

  return (
    <AppModal
      open={open}
      onClose={onClose}
      title="Masukkan PIN Slip Gaji"
      description="Nominal hanya dikirim server setelah PIN terverifikasi. Sesi buka berlaku 15 menit."
      maxWidth="max-w-md"
    >
      <form onSubmit={handleUnlock} className="space-y-5">
        <div className="flex items-center justify-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-accent">
            <LockKeyhole size={20} className="text-primary" />
          </span>
        </div>
        <PinInput label="PIN (6 digit)" value={pin} onChange={setPin} autoFocus disabled={isLockedNow} />
        {isLockedNow && lockedUntil && (
          <p className="rounded-field bg-danger-bg px-3.5 py-2.5 text-xs text-danger">
            Terlalu banyak percobaan salah. Coba lagi setelah {formatDateTime(lockedUntil)}.
          </p>
        )}
        {error && <p className="text-xs font-medium text-danger">{error}</p>}
        <div className="flex justify-end gap-2.5">
          <Button type="button" variant="outline" size="sm" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" size="sm" disabled={submitting || isLockedNow || pin.length !== PIN_LENGTH}>
            {submitting ? 'Memverifikasi...' : 'Buka nominal'}
          </Button>
        </div>
      </form>
    </AppModal>
  );
}
