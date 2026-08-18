export type PWADisplayMode = 'STANDALONE' | 'MINIMAL_UI' | 'FULLSCREEN' | 'BROWSER' | string;
export type PWAIconPurpose = 'any' | 'maskable' | 'monochrome' | string;

export interface PWAIcon {
  src: string;
  sizes?: string | null;  // e.g., "192x192" "512x512" "192x192 512x512"
  type?: string | null;   // e.g., "image/png"
  purpose?: PWAIconPurpose | PWAIconPurpose[] | null;
}

export interface WebManifest {
  name: string;
  short_name?: string | null;
  start_url?: string | null;
  scope?: string | null;
  display?: PWADisplayMode | null;
  background_color?: string | null;
  theme_color?: string | null;
  icons?: PWAIcon[] | null;
  description?: string | null;
  orientation?: string | null;
  lang?: string | null;
}

export interface ManifestValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  hasIcon192: boolean;
  hasIcon512: boolean;
}

const THEME_HEX_REGEX = /^#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})$/;

export const PWA_MIN_REQUIRED_FIELDS = Object.freeze(['name', 'start_url', 'icons']);

export const MAX_PUSH_TITLE_BYTES = 100;
export const MAX_PUSH_BODY_BYTES = 500;
export const MAX_PUSH_ICON_URL_BYTES = 500;

function ut8ByteLen(s: string): number {
  return new Blob([s]).size;
}

function parseIconSize(s: string | null | undefined): Set<number> {
  const sizes = new Set<number>();
  if (!s) return sizes;
  const parts = s.split(/\s+/).filter(Boolean);
  for (const p of parts) {
    const [w, h] = p.split('x', 2);
    const nw = Number(w), nh = Number(h);
    if (!Number.isNaN(nw) && nw > 0) sizes.add(nw);
    if (!Number.isNaN(nh) && nh > 0 && nh !== nw) sizes.add(nh);
  }
  return sizes;
}

function validateHexColor(color: unknown): boolean {
  if (typeof color !== 'string' || color.length === 0) return false;
  return THEME_HEX_REGEX.test(color.trim());
}

function findPurposeInIcons(icons: PWAIcon[], purpose: string, size: number): boolean {
  for (const icon of icons) {
    if (!icon || typeof icon !== 'object') continue;
    const sizes = parseIconSize(icon.sizes ?? null);
    const hasSize = sizes.has(size);
    if (!hasSize) continue;
    const p = icon.purpose;
    if (purpose === 'any' && (!p || p === 'any' || (Array.isArray(p) && p.includes('any')))) return true;
    if (Array.isArray(p) && p.includes(purpose)) return true;
    if (typeof p === 'string' && p === purpose) return true;
    if (purpose === 'any' && !icon.purpose) return true; // default purpose "any" jika tidak ada
  }
  return false;
}

const ALLOWED_DISPLAY = new Set(['standalone', 'minimal-ui', 'fullscreen', 'browser']);
const DEFAULT_START_URL_REGEX = /^\//;

export function validateWebManifest(manifest: WebManifest | Record<string, unknown> | null | undefined): ManifestValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  if (!manifest || typeof manifest !== 'object') {
    return { valid: false, errors: ['Manifest bukan object yang valid (null/undefined/primitive).'], warnings, hasIcon192: false, hasIcon512: false };
  }
  const name = (manifest as any).name;
  if (!name || typeof name !== 'string' || name.trim().length < 2) errors.push('`name` wajib diisi minimal 2 karakter.');
  if (name && name.length > 45) warnings.push('`name` > 45 karakter: bisa terpotong di launcher mobile.');
  const shortName = (manifest as any).short_name;
  if (!shortName || typeof shortName !== 'string' || shortName.trim().length === 0) {
    warnings.push('`short_name` tidak ada (disarankan ≤ 12 karakter untuk launcher icon label).');
  } else if (shortName.length > 12) {
    warnings.push('`short_name` panjang > 12 karakter: akan terpotong di launcher label.');
  }
  const start = (manifest as any).start_url;
  if (!start || typeof start !== 'string' || start.trim().length === 0) {
    errors.push('`start_url` wajib diisi (mis. `/` atau `/dashboard`).');
  } else if (!DEFAULT_START_URL_REGEX.test(start)) {
    warnings.push('`start_url` disarankan relative path (diawali `/`) agar cross origin aman.');
  }
  const display = String((manifest as any).display ?? 'standalone').toLowerCase();
  if (display !== 'standalone' && display !== 'minimal-ui') {
    if (ALLOWED_DISPLAY.has(display)) warnings.push(`display=${display}: bukan installable app mode (disarankan STANDALONE atau MINIMAL_UI).`);
    else errors.push(`display=${display} tidak valid sesuai W3C manifest spec.`);
  }
  const tc = (manifest as any).theme_color;
  if (!tc || !validateHexColor(tc)) {
    errors.push('`theme_color` wajib valid format hex #RRGGBB (atau #RGB). Contoh: #4f46e5.');
  }
  const bg = (manifest as any).background_color;
  if (bg && !validateHexColor(bg)) warnings.push('`background_color` format hex tidak valid (abaikan jika pakai color name).');

  const icons = Array.isArray((manifest as any).icons) ? ((manifest as any).icons as PWAIcon[]) : null;
  let has192 = false;
  let has512 = false;
  if (!icons || icons.length === 0) {
    errors.push('`icons` array wajib minimal 2 ukuran (192x192 + 512x512) untuk install PWA.');
  } else {
    has192 = hasPurposeIn(icons, 192);
    has512 = hasPurposeIn(icons, 512);
    if (!has192) errors.push('Tidak ada icon 192x192 (ukuran minimum Add To Home Screen).');
    if (!has512) errors.push('Tidak ada icon 512x512 (ukuran minimum splash screen PWA + Play Store mask).');
    const hasMaskable512 = icons.some(ic => {
      const s = parseIconSize(ic.sizes ?? null).has(512);
      if (!s) return false;
      const p = ic.purpose;
      return (typeof p === 'string' && p === 'maskable') || (Array.isArray(p) && p.includes('maskable'));
    });
    if (!hasMaskable512) warnings.push('Icon 512x512 tanpa purpose `maskable` — shape adaptive icon Android tidak akan bagus.');
  }
  return { valid: errors.length === 0, errors, warnings, hasIcon192: has192, hasIcon512: has512 };
}

function hasPurposeIn(icons: PWAIcon[], size: number): boolean {
  for (const ic of icons) {
    const set = parseIconSize(ic.sizes ?? null);
    if (set.has(size)) return true;
  }
  return false;
}

export interface PushPayload {
  title: string;
  body?: string | null;
  iconUrl?: string | null;
  badgeUrl?: string | null;
  imageUrl?: string | null;
  data?: unknown;
  tag?: string | null;
  requireInteraction?: boolean | null;
  silent?: boolean | null;
  clickActionUrl?: string | null;
}

export interface PushValidateResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  sanitized: {
    title: string;
    body: string;
    iconUrl: string | null;
    badgeUrl: string | null;
    imageUrl: string | null;
  };
  truncatedTitle: boolean;
  truncatedBody: boolean;
}

export function validatePushNotificationPayload(payload: PushPayload | null | undefined): PushValidateResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  let truncatedTitle = false;
  let truncatedBody = false;
  const sanitizedTitleRaw = payload && typeof payload.title === 'string' ? payload.title : '';
  if (sanitizedTitleRaw.trim().length === 0) errors.push('Push notification `title` wajib diisi.');
  const byteLenT = ut8ByteLen(sanitizedTitleRaw);
  let title = sanitizedTitleRaw;
  if (byteLenT > MAX_PUSH_TITLE_BYTES) {
    truncatedTitle = true;
    // Potong hingga byte len <= MAX
    let t = title;
    while (ut8ByteLen(t) > MAX_PUSH_TITLE_BYTES) t = t.slice(0, -1);
    title = t;
    errors.push(`\`title\` terlalu panjang (${byteLenT} bytes > ${MAX_PUSH_TITLE_BYTES}). Terpotong otomatis (truncate).`);
  }
  const bodyRaw = payload && typeof payload.body === 'string' ? payload.body : '';
  let body = bodyRaw;
  const byteLenB = ut8ByteLen(bodyRaw);
  if (byteLenB > MAX_PUSH_BODY_BYTES) {
    truncatedBody = true;
    while (ut8ByteLen(body) > MAX_PUSH_BODY_BYTES) body = body.slice(0, -1);
    warnings.push(`\`body\` > ${MAX_PUSH_BODY_BYTES} bytes (${byteLenB}) — akan terpotong di mobile.`);
  }
  const ico = payload && typeof payload.iconUrl === 'string' && payload.iconUrl.length > 0 ? payload.iconUrl : null;
  const bad = payload && typeof payload.badgeUrl === 'string' && payload.badgeUrl.length > 0 ? payload.badgeUrl : null;
  const img = payload && typeof payload.imageUrl === 'string' && payload.imageUrl.length > 0 ? payload.imageUrl : null;
  if (ico && ico.length > MAX_PUSH_ICON_URL_BYTES) errors.push('iconUrl URL terlalu panjang (>500 karakter).');
  if (payload && payload.silent && payload.requireInteraction) warnings.push('`silent=true` bertentangan dengan `requireInteraction=true` (perilaku undefined).');
  return {
    valid: errors.length === 0, errors, warnings,
    sanitized: { title, body, iconUrl: ico, badgeUrl: bad, imageUrl: img },
    truncatedTitle, truncatedBody,
  };
}

export interface InstallableContext {
  manifestValid?: boolean | null; // optional, default false = dihitung via validateWebManifest
  manifest?: WebManifest | null;
  httpsOrLocalhost: boolean; // protocol https or http://localhost (dan 127.0.0.1)
  serviceWorkerRegistered: boolean;
  serviceWorkerScope?: string | null;
  startUrl?: string | null;
  userEngagementVisits?: number | null; // Chrome heuristic ≥ 5 visits (non-blocking)
}

export interface InstallableCheckResult {
  installable: boolean;
  percentageScore: number; // 0..100. 90+ = almost certain installable
  missing: string[];
  warnings: string[];
  reason: string | null;
}

export function checkA2hsInstallabilityCriteria(ctx: InstallableContext): InstallableCheckResult {
  const missing: string[] = [];
  const warnings: string[] = [];
  const manifest = ctx.manifest ?? null;
  const manifestValidPass = typeof ctx.manifestValid === 'boolean'
    ? ctx.manifestValid
    : (manifest ? validateWebManifest(manifest).valid : false);
  if (!manifestValidPass) missing.push('Manifest tidak valid (cek required fields + icons 192+512).');
  if (!ctx.httpsOrLocalhost) missing.push('Protocol bukan HTTPS dan bukan localhost (require secure context).');
  if (!ctx.serviceWorkerRegistered) missing.push('Service Worker belum didaftarkan (fetch event / offline capability).');
  // scope prefix check: scope harus prefix dari start_url
  if (ctx.serviceWorkerRegistered && ctx.serviceWorkerScope && ctx.startUrl) {
    const scope = ctx.serviceWorkerScope;
    if (!ctx.startUrl.startsWith(scope)) {
      warnings.push('`scope` service worker tidak prefix dari start_url — navigasi akan keluar dari app window PWA.');
    }
  }
  const visits = Number(ctx.userEngagementVisits ?? 5);
  if (visits < 5) warnings.push(`User engagement < 5 kunjungan (heuristic Chrome), A2HS prompt mungkin ditunda browser.`);
  const totalChecks = 3;
  const passCount = totalChecks - missing.length;
  const percentageScore = Math.max(0, Math.min(100,
    Math.round((passCount / totalChecks) * 90 + (manifestValidPass ? (validateWebManifest(manifest ?? {}).warnings.length === 0 ? 10 : 5) : 0)
    - warnings.length * 2
  )));
  return {
    installable: missing.length === 0,
    percentageScore,
    missing, warnings,
    reason: missing.length === 0 ? 'All PWA installability criteria satisfied (A2HS prompt eligible).' : missing.join(' | '),
  };
}
