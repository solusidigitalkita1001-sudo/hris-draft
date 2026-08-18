import {
  validateWebManifest,
  validatePushNotificationPayload,
  checkA2hsInstallabilityCriteria,
  type WebManifest,
} from './manifest-validators';

const validManifest: WebManifest = {
  name: 'GreatDay Parity HRIS Mobile',
  short_name: 'HRIS Mobile',
  start_url: '/dashboard',
  scope: '/',
  display: 'STANDALONE',
  theme_color: '#4338ca',
  background_color: '#ffffff',
  icons: [
    { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable any' },
  ],
  description: 'HRIS GreatDay Parity — Penggajian, Absensi, dan Employee Self-Service',
  lang: 'id',
};

describe('D.5 PWA manifest + installability + push validators pure functions', () => {
  it('D.5 CASE1: Manifest complete = valid true, icons 192 + 512 OK. warnings = maskable sudah ada warning length = 0.', () => {
    const r = validateWebManifest(validManifest);
    expect(r.valid).toBe(true);
    expect(r.hasIcon192).toBe(true);
    expect(r.hasIcon512).toBe(true);
    expect(r.errors.length).toBe(0);
  });

  it('D.5 CASE2: Manifest icons cuma 192x192 (hilang 512) → hasIcon512=false, valid false karena errors ≥1. errors list include "512".', () => {
    const missing512: WebManifest = { ...validManifest, icons: [{ src: '/i192.png', sizes: '192x192', purpose: 'any' }] };
    const r = validateWebManifest(missing512);
    expect(r.valid).toBe(false);
    expect(r.hasIcon512).toBe(false);
    expect(r.hasIcon192).toBe(true);
    expect(r.errors.some(e => e.includes('512'))).toBe(true);
  });

  it('D.5 CASE3: theme_color tidak valid hex `#GG1234` (GG bukan heksadesimal) + `indigo` named color → errors include theme_color.', () => {
    const bad: WebManifest = { ...validManifest, theme_color: '#GG1234' };
    const r = validateWebManifest(bad);
    expect(r.valid).toBe(false);
    expect(r.errors.some(e => e.toLowerCase().includes('theme_color'))).toBe(true);
  });

  it('D.5 CASE4: Push payload title 120 huruf a (byte len 120 > MAX 100) → errors length ≥1, truncatedTitle=true, sanitized.title length dipotong. Payload normal title pendek → valid=true.', () => {
    const long = 'a'.repeat(120);
    const bad = validatePushNotificationPayload({ title: long });
    expect(bad.valid).toBe(false);
    expect(bad.truncatedTitle).toBe(true);
    expect(bad.sanitized.title.length).toBeLessThan(120);
    // valid normal
    const normal = validatePushNotificationPayload({
      title: 'Gaji Sudah Masuk!',
      body: 'Gaji bulan ini sudah ditransfer. Lihat payslip Anda.',
      iconUrl: '/icons/notify-128.png',
    });
    expect(normal.valid).toBe(true);
    expect(normal.truncatedBody).toBe(false);
  });

  it('D.5 CASE5: A2HS (Add to Home Screen) — manifest + HTTPS + serviceWorkerRegistered → installable=true, score 90+. Tanpa SW → installable=false, missing="Service Worker".', () => {
    const good = checkA2hsInstallabilityCriteria({
      manifest: validManifest,
      httpsOrLocalhost: true,
      serviceWorkerRegistered: true,
      serviceWorkerScope: '/',
      startUrl: '/dashboard',
    });
    expect(good.installable).toBe(true);
    expect(good.percentageScore).toBeGreaterThanOrEqual(90);
    const noSW = checkA2hsInstallabilityCriteria({ manifest: validManifest, httpsOrLocalhost: true, serviceWorkerRegistered: false });
    expect(noSW.installable).toBe(false);
    expect(noSW.missing.some(m => m.match(/Service Worker/i))).toBe(true);
    // http + bukan localhost -> missing "secure context"
    const notSecure = checkA2hsInstallabilityCriteria({ manifest: validManifest, httpsOrLocalhost: false, serviceWorkerRegistered: true });
    expect(notSecure.installable).toBe(false);
    expect(notSecure.missing.some(m => m.match(/HTTPS|localhost|secure/i))).toBe(true);
  });
});
