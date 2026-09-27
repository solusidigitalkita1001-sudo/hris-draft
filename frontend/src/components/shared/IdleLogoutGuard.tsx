import { useCallback, useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { TimerReset } from 'lucide-react';
import { appConfig } from '@/config/app';
import { useAuthStore } from '@/stores/auth.store';
import { useI18n } from '@/i18n/provider';
import { Button } from '@/components/ui/button';

const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  'mousemove',
  'mousedown',
  'keydown',
  'scroll',
  'touchstart',
];

/** Tulis aktivitas paling sering tiap 5 detik supaya tidak spam localStorage. */
const ACTIVITY_WRITE_THROTTLE_MS = 5_000;
const CHECK_INTERVAL_MS = 1_000;

function readSharedActivity(): number {
  const raw = localStorage.getItem(appConfig.lastActivityKey);
  const value = raw ? Number(raw) : NaN;
  return Number.isFinite(value) ? value : Date.now();
}

/**
 * Auto-logout saat idle (SEC): tanpa aktivitas selama `idleTimeoutMinutes`,
 * sesi diakhiri — refresh token dicabut via /auth/logout lalu diarahkan ke
 * /login. 60 detik sebelum batas, modal peringatan dengan hitung mundur
 * memberi kesempatan melanjutkan sesi. Aktivitas disinkronkan antar-tab
 * lewat localStorage sehingga mengetik di satu tab menjaga tab lainnya.
 */
export function IdleLogoutGuard() {
  const { user, logout } = useAuthStore();
  const { t } = useI18n();
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const lastActivityRef = useRef<number>(Date.now());
  const lastWriteRef = useRef<number>(0);
  const loggingOutRef = useRef(false);

  const idleLimitMs = appConfig.idleTimeoutMinutes * 60_000;
  const warningMs = appConfig.idleWarningSeconds * 1_000;
  const enabled = !!user && Number.isFinite(idleLimitMs) && idleLimitMs > 0;

  const recordActivity = useCallback(() => {
    const now = Date.now();
    lastActivityRef.current = now;
    if (now - lastWriteRef.current >= ACTIVITY_WRITE_THROTTLE_MS) {
      lastWriteRef.current = now;
      localStorage.setItem(appConfig.lastActivityKey, String(now));
    }
  }, []);

  const stayLoggedIn = useCallback(() => {
    lastWriteRef.current = 0; // paksa tulis lintas-tab
    recordActivity();
    setSecondsLeft(null);
  }, [recordActivity]);

  const performLogout = useCallback(async () => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    toast.error(t('idle.expired'), { id: 'idle-logout', duration: 6000 });
    await logout();
    window.location.href = '/login';
  }, [logout, t]);

  // Pantau aktivitas pengguna di tab ini + tab lain.
  useEffect(() => {
    if (!enabled) return;

    lastActivityRef.current = Date.now();
    localStorage.setItem(appConfig.lastActivityKey, String(lastActivityRef.current));

    const onActivity = () => recordActivity();
    ACTIVITY_EVENTS.forEach((event) => window.addEventListener(event, onActivity, { passive: true }));

    const onStorage = (event: StorageEvent) => {
      if (event.key === appConfig.lastActivityKey && event.newValue) {
        const value = Number(event.newValue);
        if (Number.isFinite(value) && value > lastActivityRef.current) {
          lastActivityRef.current = value;
        }
      }
    };
    window.addEventListener('storage', onStorage);

    return () => {
      ACTIVITY_EVENTS.forEach((event) => window.removeEventListener(event, onActivity));
      window.removeEventListener('storage', onStorage);
    };
  }, [enabled, recordActivity]);

  // Evaluasi idle tiap detik (termasuk saat tab kembali dari sleep).
  useEffect(() => {
    if (!enabled) return;

    const check = () => {
      const shared = readSharedActivity();
      const last = Math.max(lastActivityRef.current, shared);
      const idleMs = Date.now() - last;

      if (idleMs >= idleLimitMs) {
        void performLogout();
        return;
      }
      if (idleMs >= idleLimitMs - warningMs) {
        setSecondsLeft(Math.max(1, Math.ceil((idleLimitMs - idleMs) / 1000)));
      } else {
        setSecondsLeft((current) => (current === null ? current : null));
      }
    };

    const interval = window.setInterval(check, CHECK_INTERVAL_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, idleLimitMs, warningMs, performLogout]);

  if (!enabled || secondsLeft === null) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="idle-title"
        aria-describedby="idle-body"
        className="relative w-full max-w-sm rounded-card border border-border bg-card p-6 text-center shadow-float"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-warning-bg text-warning">
          <TimerReset size={22} aria-hidden="true" />
        </span>
        <h2 id="idle-title" className="mt-4 text-base font-semibold tracking-[-0.3px]">
          {t('idle.title')}
        </h2>
        <p id="idle-body" className="mt-1.5 text-sm text-muted-foreground">
          {t('idle.body', { seconds: secondsLeft })}
        </p>
        <div className="mt-3 text-3xl font-semibold tabular-nums tracking-[-1px] text-warning" aria-hidden="true">
          {secondsLeft}
        </div>
        <div className="mt-5 flex gap-2.5">
          <Button variant="outline" className="flex-1" onClick={() => void performLogout()}>
            {t('idle.logout')}
          </Button>
          <Button className="flex-1" autoFocus onClick={stayLoggedIn}>
            {t('idle.stay')}
          </Button>
        </div>
      </div>
    </div>
  );
}
