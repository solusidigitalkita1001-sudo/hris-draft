# Panduan Optimasi, Hardening, dan Validasi Teknis

Dokumen ini berisi panduan implementasi teknis detail untuk setiap kategori perbaikan, termasuk code pattern, contoh implementasi, dan lokasi file yang perlu dimodifikasi.

---

## Bagian 1: Security Hardening Teknis

### 1.1 Config Env Validation — Mencegah Fallback Secret

**Target**: Ganti pattern `getEnv(key, fallback)` yang berbahaya dengan strict Zod validation yang THROW ERROR saat required env tidak ada di production.

**Langkah Implementasi**:

1. Buat file `backend/src/config/schema.ts` — Zod schema strict validation:

```typescript
import { z } from 'zod';

const nodeEnvSchema = z.enum(['development', 'staging', 'production', 'test']);

// Untuk field secret: required MINIMAL 32 chars di production, tidak boleh default fallback
const secretMin32 = z
  .string()
  .min(32, 'Secret minimal 32 characters untuk production')
  .refine((v) => !v.startsWith('fallback-'), {
    message: 'JANGAN gunakan fallback secret di production',
  });

export const envSchema = z.object({
  // Required di SEMUA environment (tidak boleh default)
  NODE_ENV: nodeEnvSchema.default('development'),
  DATABASE_URL: z.string().url('DATABASE_URL harus format URL MySQL valid'),
  JWT_ACCESS_SECRET: secretMin32,
  JWT_REFRESH_SECRET: secretMin32,
  SESSION_SECRET: secretMin32,
  CSRF_SECRET: secretMin32,
  ENCRYPTION_KEY: z.string().length(32, 'ENCRYPTION_KEY harus tepat 32 karakter (AES-256)'),

  // Optional dengan default hanya untuk dev
  REDIS_ENABLED: z.boolean().default(true),
  REDIS_HOST: z.string().default('localhost'),
  REDIS_PORT: z.coerce.number().int().positive().default(6379),
  // ... tambahkan semua field dari current Config interface
});

// Pre-validate saat module load — SEBELUM apapun berjalan
const result = envSchema.safeParse(process.env);
if (!result.success) {
  console.error('❌ VALIDASI ENVIRONMENT GAGAL:');
  result.error.issues.forEach((issue) => {
    console.error(`  - [${issue.path.join('.')}] ${issue.message}`);
  });
  console.error('\nPerbaiki file .env sebelum menjalankan aplikasi.');
  process.exit(1);
}

export type ValidatedEnv = z.infer<typeof envSchema>;
```

2. Refactor `backend/src/config/index.ts` untuk memakai `result.data` dari schema di atas, BUKAN `process.env` + default fallback.

**File dimodifikasi**:
- [config/index.ts](file:///Users/f/Documents/sdk-project/hris-draft/backend/src/config/index.ts)
- File baru: `config/schema.ts`

---

### 1.2 CSRF Protection Double Submit Cookie Pattern

**Target**: Semua endpoint `POST/PUT/PATCH/DELETE` wajib kirim `X-CSRF-Token` header, divalidasi dengan cookie `XSRF-TOKEN` (HttpOnly tidak, tapi signed).

**Langkah Implementasi**:

1. Install dependency `csrf-csrf` (ringan, Express-native):

```bash
cd backend && npm install csrf-csrf && npm install -D @types/node
```

2. Modifikasi `app.ts` setelah cookieParser:

```typescript
import { doubleCsrf } from 'csrf-csrf';

const {
  invalidCsrfTokenError,
  generateTokenAndSetCookie,
  doubleCsrfProtection,
} = doubleCsrf({
  getSecret: (req) => req?.secret ?? config.csrf.secret,
  cookieName: 'XSRF-TOKEN',
  cookieOptions: {
    sameSite: 'lax',
    path: '/',
    secure: config.app.env === 'production',
    httpOnly: false, // JS di client perlu baca value untuk kirim header
    signed: true,
    maxAge: 1000 * 60 * 60 * 24, // 24 jam
  },
  size: 64,
  ignoredMethods: ['GET', 'HEAD', 'OPTIONS'],
  getTokenFromRequest: (req) => req.headers['x-csrf-token'] as string,
});

// Endpoint untuk ambil CSRF token sebelum submit form mutation
app.get(`${apiPrefix}/csrf-token`, authenticate, (req, res) => {
  generateTokenAndSetCookie(res);
  res.json({ success: true });
});

// Apply protection HANYA ke mutation endpoint, GET/HEAD/OPTIONS skip
app.use((req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  // Skip CSRF untuk endpoint API dengan Bearer token stateless (tidak pakai cookie auth)
  // Karena sistem kita memakai Bearer JWT (bukan cookie session auth), CSRF attack vector BERKURANG.
  // Tetap apply protection untuk extra defense-in-depth.
  return doubleCsrfProtection(req, res, next);
});

// Global error handler sesuaikan invalidCsrfTokenError
// ... di ErrorHandler.ts tambahkan case:
if (err === invalidCsrfTokenError) {
  return res.status(403).json({
    success: false,
    code: 'INVALID_CSRF_TOKEN',
    message: 'CSRF token tidak valid. Silakan refresh halaman.',
  });
}
```

3. Modifikasi frontend `services/api.ts` (axios interceptor):
   - Sebelum request POST/PUT/PATCH/DELETE: hit GET `/api/v1/csrf-token` dapetin cookie
   - Baca `XSRF-TOKEN` dari document.cookie via `js-cookie` library
   - Inject ke header `X-CSRF-Token: <value>`

---

### 1.3 Field Level PII Encryption (AES-256-GCM + Prisma Middleware)

**Target**: NIK, NPWP, BPJS, rekening bank, phone, address — ciphertext di DB, plaintext di API response authorized.

**Langkah Implementasi**:

1. Buat `backend/src/shared/security/FieldEncryption.ts`:

```typescript
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';
import config from '@/config';

const ALGORITHM = 'aes-256-gcm';
const KEY_LEN = 32;
const IV_LEN = 12;
const TAG_LEN = 16;
const SALT = 'hris-enterprise-field-enc-salt';

// Derive encryption key 32 byte dari config key via scrypt (slow, tahan brute force)
const derivedKey = scryptSync(config.encryption.key, SALT, KEY_LEN);

export const encryptField = (plaintext: string | null): string | null => {
  if (plaintext == null || plaintext === '') return plaintext;
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGORITHM, derivedKey, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Gabung: iv(12) + authTag(16) + ciphertext — base64 encoded single string
  return Buffer.concat([iv, authTag, encrypted]).toString('base64');
};

export const decryptField = (ciphertext: string | null): string | null => {
  if (ciphertext == null || ciphertext === '') return ciphertext;
  // Legacy data check: jika bukan base64 dengan panjang minimal IV+TAG = 28 bytes -> return as-is (backward compat)
  try {
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < IV_LEN + TAG_LEN) return ciphertext; // data lama plaintext
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + TAG_LEN);
    const data = buf.subarray(IV_LEN + TAG_LEN);
    const decipher = createDecipheriv(ALGORITHM, derivedKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch {
    // Gagal decrypt: kemungkinan data lama plaintext, kembalikan apa adanya
    return ciphertext;
  }
};

// List field names yang perlu encrypt/decrypt otomatis per model
export const ENCRYPTED_FIELDS: Record<string, string[]> = {
  Employee: [
    'idNumber', 'taxId', 'bpjsKetenagakerjaan', 'bpjsKesehatan',
    'bankAccount', 'bankAccountHolder', 'phone', 'address',
  ],
  Payslip: ['baseSalary', 'netPay'], // DECIMAL field, convert string encrypt
};
```

2. Daftarkan Prisma Client Middleware di `shared/database/prisma.ts` sebelum export singleton:

```typescript
prisma.$use(async (params, next) => {
  // Encrypt saat create/update
  if (['create', 'update', 'upsert', 'createMany', 'updateMany'].includes(params.action)) {
    const fields = ENCRYPTED_FIELDS[params.model || ''];
    if (fields?.length && params.args?.data) {
      for (const field of fields) {
        if (typeof params.args.data[field] === 'string') {
          params.args.data[field] = encryptField(params.args.data[field]);
        }
      }
    }
  }
  const result = await next(params);
  // Decrypt saat query find result (single atau array)
  const fields = ENCRYPTED_FIELDS[params.model || ''];
  if (fields?.length && result) {
    const decrypt = (obj: any) => {
      if (!obj) return obj;
      for (const field of fields) {
        if (typeof obj[field] === 'string') {
          obj[field] = decryptField(obj[field]);
        }
      }
      return obj;
    };
    if (Array.isArray(result)) result.forEach(decrypt);
    else decrypt(result);
  }
  return result;
});
```

3. **Backfill Migration**: Buat script `scripts/encrypt-existing-data.ts` untuk me-run update semua existing records (bulk 100 row/chunk) — encrypt data lama yang masih plaintext (decryptField detect plaintext → return apa adanya, jadi ini hanya jalan 1x pada data yang belum encrypted). JANGAN di Prisma migration SQL — jalan via `tsx scripts/encrypt-existing-data.ts` SEBELUM production deploy.

---

### 1.4 Refresh Token Whitelist + Access Token Blacklist Redis

**Target**: Stolen token attack invalidation mechanism.

**Langkah 1 — Modifikasi `AuthService.login()`**: Saat generate refresh token, simpan ke DB `RefreshToken` dengan `expiresAt` (7 hari). Return `refreshToken` JTI.

**Langkah 2 — `POST /auth/logout` handler baru**:
```typescript
// Body: { refreshToken? }
async logout(userId: string, accessToken?: string, refreshTokenJti?: string) {
  // 1. Hapus refresh token whitelist record
  if (refreshTokenJti) {
    await prisma.refreshToken.deleteMany({ where: { jti: refreshTokenJti, userId } });
  }
  // 2. Blacklist access token sisa TTL di Redis dengan pattern
  if (accessToken) {
    const decoded = jwt.decode(accessToken); // tanpa verify, ambil exp
    const ttl = Math.max(0, decoded.exp - Math.floor(Date.now() / 1000));
    if (ttl > 0 && config.redis.enabled) {
      await redisCache.set(`hrms:blacklist:access:${decoded.jti}`, '1', ttl);
    }
  }
}
```

**Langkah 3 — Modifikasi `Authenticate.ts` middleware**: Setelah verify access token sukses, check apakah `jti` ada di Redis blacklist:
```typescript
if (decoded.jti) {
  const blacklisted = await redisCache.get(`hrms:blacklist:access:${decoded.jti}`);
  if (blacklisted) throw new AuthError('Access token sudah di-revoke. Silakan login ulang.');
}
```

**Langkah 4 — `POST /auth/refresh` endpoint**: Validasi refresh token signature DAN check exists di `RefreshToken` table, status `revokedAt = null`, dan `userId` match. Jika cocok, rotate: delete lama, generate refresh token BARU (reuse detection attack protection).

---

### 1.5 Signed URL Document Access (Anti IDOR Static Files)

**Target**: `/uploads/payslip-xxx.pdf` hanya bisa diakses via signed URL TTL 15m yang authorized.

**Langkah**:

1. Hapus line di `app.ts`:
   ```typescript
   // HAPUS INI:
   // app.use('/uploads', express.static(path.resolve(process.cwd(), config.upload.uploadPath)));
   ```

2. Tambah endpoint baru di `document-management` module:
```typescript
// GET /api/v1/documents/:id/access
router.get(
  '/:id/access',
  authenticate,
  async (req, res, next) => {
    try {
      const doc = await prisma.document.findUniqueOrThrow({ where: { id: req.params.id } });
      // 1. Check permission & ownership
      const allow =
        req.user?.roles?.includes('SUPER_ADMIN') ||
        doc.companyId === req.user?.companyId ||
        doc.uploadedByUserId === req.user?.id;
      if (!allow) throw new ForbiddenError('Dokumen ini tidak bisa diakses');

      // 2. Generate signed URL dengan HMAC
      const fileKey = doc.filePath; // misal 'payslips/2026/07/EMP001.pdf'
      const expiresAt = Math.floor(Date.now() / 1000) + 60 * 15; // 15 menit
      const signaturePayload = `${fileKey}|${expiresAt}`;
      const signature = crypto
        .createHmac('sha256', config.encryption.key)
        .update(signaturePayload)
        .digest('hex');

      const signedUrl = `${config.app.url}/api/v1/documents/file?key=${encodeURIComponent(fileKey)}&exp=${expiresAt}&sig=${signature}`;
      res.json({ success: true, url: signedUrl, mime: doc.mimeType, fileName: doc.name });
    } catch (e) { next(e); }
  }
);

// Public endpoint serve file (no auth) TAPI validasi signature + expiry
router.get('/file', (req, res, next) => {
  try {
    const { key, exp, sig } = req.query as Record<string, string>;
    if (!key || !exp || !sig) throw new BadRequestError('Invalid signed URL parameters');

    // 1. Check expiry
    if (parseInt(exp, 10) < Math.floor(Date.now() / 1000)) {
      throw new ForbiddenError('URL sudah expired, silakan generate ulang');
    }

    // 2. Check signature match
    const expectedSig = crypto
      .createHmac('sha256', config.encryption.key)
      .update(`${key}|${exp}`)
      .digest('hex');
    const match = crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSig, 'hex'));
    if (!match) throw new ForbiddenError('URL signature tidak valid');

    // 3. Path traversal protection: key tidak boleh mengandung '..' atau absolute path
    if (key.includes('..') || path.isAbsolute(key)) throw new BadRequestError('Invalid file key');

    // 4. Serve file
    const fullPath = path.resolve(process.cwd(), config.upload.uploadPath, key);
    res.download(fullPath, (err) => {
      if (err?.message.includes('ENOENT')) next(new NotFoundError('File tidak ditemukan'));
      else next(err);
    });
  } catch (e) { next(e); }
});
```

3. **Frontend**: Ganti semua `<iframe src=`, `<img src=`, `<a href=` yang langsung ke `/uploads/` → call API `/documents/:id/access` dulu, dapetin signedUrl, baru pakai URL itu.

---

## Bagian 2: Validation Strategy Implementation

### 2.1 Master Data Validator Utility Suite

Buat folder baru `backend/src/shared/validators/` dengan file:

- `idNumber.validator.ts` — NIK KTP 16 digit, kode provinsi BPS, tanggal lahir parse
- `npwp.validator.ts` — NPWP 15 digit format + check digit
- `bpjs.validator.ts` — BPJS JHT/JKK/JKM 11 digit, JKN 13 digit
- `phone.validator.ts` — E.164 + libphonenumber-js library
- `bankAccount.validator.ts` — per-bank length validation + Luhn check digit untuk kartu kredit

**Install library untuk phone number validation** (most robust):
```bash
cd backend && npm install libphonenumber-js
```

Contoh `phone.validator.ts`:
```typescript
import { parsePhoneNumberFromString, CountryCode } from 'libphonenumber-js';

export interface ValidatedPhone {
  normalized: string;   // E.164: +6281234567890
  countryCode: string;  // ID
  nationalFormat: string; // 0812-3456-7890
  type: string; // MOBILE / FIXED_LINE / ...
}

export const validatePhoneID = (raw: string): ValidatedPhone => {
  if (!raw) throw new Error('Nomor telepon tidak boleh kosong');
  // Jika user input tanpa kode negara, default ID Indonesia
  const parsed = parsePhoneNumberFromString(raw.trim(), 'ID' as CountryCode);
  if (!parsed || !parsed.isValid()) {
    throw new Error('Format nomor telepon tidak valid untuk wilayah Indonesia');
  }
  if (parsed.country !== 'ID') {
    // Bisa config: allow internasional atau block
  }
  return {
    normalized: parsed.format('E.164'),
    countryCode: parsed.country || 'ID',
    nationalFormat: parsed.format('NATIONAL'),
    type: parsed.getType() || 'UNKNOWN',
  };
};

// Usage di employee.service.ts create/update:
const phone = validatePhoneID(data.phone || '');
data.phone = phone.normalized; // Store E.164
```

### 2.2 Zod DTO Refine Chain — Terintegrasi Validators

Contoh `employee.dto.ts` menggunakan custom validators, bukan hanya `z.string().optional()`:

```typescript
import { validatePhoneID } from '@/shared/validators/phone.validator';
import { validateNIK } from '@/shared/validators/idNumber.validator';
import { validateNPWP } from '@/shared/validators/npwp.validator';

const phoneSchema = z.string().superRefine((val, ctx) => {
  try { validatePhoneID(val); }
  catch (e: any) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.message }); }
});

const nikSchema = z.string().superRefine((val, ctx) => {
  try { validateNIK(val); }
  catch (e: any) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.message }); }
});

export const createEmployeeSchema = z.object({
  // ... field lain
  phone: phoneSchema.optional(),
  idNumber: nikSchema.optional(),
  taxId: z.string().superRefine((val, ctx) => {
    try { validateNPWP(val); }
    catch (e: any) { ctx.addIssue({ code: z.ZodIssueCode.custom, message: e.message }); }
  }).optional(),
  // Date of birth relasi dengan join date — validasi service-level nanti,
  // tapi minimal di sini parse ISO datetime benar
  dateOfBirth: z.coerce.date().max(new Date(), 'Tanggal lahir tidak boleh masa depan').optional(),
  joinDate: z.coerce.date().optional(),
}).superRefine((data, ctx) => {
  // Cross-field validation: joinDate harus > dateOfBirth + 15 tahun
  if (data.joinDate && data.dateOfBirth) {
    const minWorkAge = new Date(data.dateOfBirth);
    minWorkAge.setFullYear(minWorkAge.getFullYear() + 15);
    if (data.joinDate < minWorkAge) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['joinDate'],
        message: 'Tanggal bergabung harus setelah usia minimal 15 tahun',
      });
    }
  }
});
```

---

### 2.3 DB Unique Constraints — Add Migration

Prisma migration baru — jangan lupa handle NULL case (MySQL unique index count NULL sebagai distinct, jadi tidak masalah nullable):

```prisma
// Di schema.prisma, model Employee tambahkan @@unique:
model Employee {
  // ... fields existing

  // NEW composite unique — NIK unik dalam satu company (bisa lintas company)
  @@unique([companyId, idNumber], map: "idx_emp_company_nik_unique")
  @@unique([companyId, phone], map: "idx_emp_company_phone_unique")
}
```

```bash
cd backend && npx prisma migrate dev --name add_employee_unique_nik_phone
```

Tambahkan di ErrorHandler global untuk mapping Prisma P2002 Unique Constraint Violation:
```typescript
if (err?.code === 'P2002') {
  const field = err.meta?.target as string[] || [];
  const map: Record<string, string> = {
    idx_emp_company_nik_unique: 'NIK KTP sudah terdaftar di company ini',
    idx_emp_company_phone_unique: 'Nomor HP sudah dipakai employee lain di company ini',
  };
  const message = map[field.join('_')] || `Duplicate data untuk field: ${field.join(', ')}`;
  return res.status(409).json({ success: false, code: 'DUPLICATE_DATA', message });
}
```

---

### 2.4 Leave Race Condition Fix — Database Transaction Row Lock

Masalah VAL-011: 2 request approve leave paralel bisa bikin balance minus. Solusi: **SELECT ... FOR UPDATE** row lock + transaction isolation SERIALIZABLE.

Modifikasi `leave.service.ts approve`:

```typescript
async approve(leaveId: string, approverId: string, notes?: string) {
  // Gunakan interactive transaction dengan isolation level
  return prisma.$transaction(async (tx) => {
    // 1. Lock row leave request + employee leave balance dengan FOR UPDATE
    const leave = await tx.leaveRequest.findUnique({
      where: { id: leaveId },
      // Prisma findUnique belum support select for update via API stable, pakai raw query alternative:
      // Atau lebih robust: tx.$queryRaw`SELECT * FROM leave_requests WHERE id=${leaveId} FOR UPDATE`
    });
    if (!leave) throw new NotFoundError('Leave request tidak ditemukan');
    if (leave.status !== 'PENDING') throw new ConflictError('Leave sudah di-approve / reject');

    // 2. Lock & get CURRENT balance row untuk update
    const balance = await tx.leaveBalance.findFirst({
      where: { employeeId: leave.employeeId, leaveTypeId: leave.leaveTypeId, year: new Date().getFullYear() },
      // $queryRaw ... FOR UPDATE here if needed
    })!;

    const daysRequested = leave.days;
    if (balance.remainingDays < daysRequested) {
      throw new BadRequestError(`Sisa cuti tidak cukup. Tersisa ${balance.remainingDays} hari, diminta ${daysRequested} hari.`);
    }

    // 3. Kurangi balance atomically dalam transaction yang sama
    const updatedBalance = await tx.leaveBalance.update({
      where: { id: balance.id },
      data: {
        remainingDays: { decrement: daysRequested },
        usedDays: { increment: daysRequested },
      },
    });

    // 4. Update leave status
    const approved = await tx.leaveRequest.update({
      where: { id: leaveId },
      data: { status: 'APPROVED', approverId, approvedAt: new Date(), notes },
    });

    return { leave: approved, balanceAfter: updatedBalance };
  }, {
    // Prisma 5.22+: setIsolationLevel support SERIALIZABLE
    isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    maxWait: 5000,
    timeout: 10000,
  });
}
```

---

## Bagian 3: Performance Optimization

### 3.1 Service Layer Caching Abstraction + Cache Invalidation via Event Bus

Pattern: decorator/wrapper untuk method `find*` service → cache TTL, event subscriber invalidasi saat mutation.

**Buat `shared/cache/Cached.ts` decorator**:

```typescript
import { redisCache } from '@/infrastructure/cache/RedisCache';
import { eventBus } from '@/shared/events/EventBus';
import { DomainEvents } from '@/shared/events/events';

type CacheOptions = {
  ttlMs: number;
  keyPrefix: string; // e.g. 'leave_types'
  companyScoped?: boolean; // TRUE: key includes companyId
};

export const Cached = <T extends (...args: any[]) => Promise<any>>(options: CacheOptions) =>
  (originalMethod: T, context: ClassMethodDecoratorContext) => {
    const methodName = String(context.name);

    const replacement = async function (this: any, ...args: Parameters<T>): Promise<ReturnType<T>> {
      // Extract first arg: biasanya query object { companyId, ... }
      const firstArg = args[0] || {};
      const companyId = options.companyScoped ? firstArg?.companyId || firstArg : 'global';
      const argsHash = crypto.createHash('md5').update(JSON.stringify(args)).digest('hex').slice(0, 8);
      const cacheKey = `hrms:cache:v1:${options.keyPrefix}:${companyId}:${methodName}:${argsHash}`;

      // 1. Try cache hit
      if (config.redis.enabled) {
        const cached = await redisCache.get(cacheKey);
        if (cached) return JSON.parse(cached) as ReturnType<T>;
      }

      // 2. Cache miss, execute asli
      const result = await originalMethod.apply(this, args);

      // 3. Store ke cache (async, tidak await jangan block response)
      if (config.redis.enabled && result != null) {
        redisCache.set(cacheKey, JSON.stringify(result), Math.floor(options.ttlMs / 1000))
          .catch(() => {});
      }
      return result;
    };

    return replacement as T;
  };
```

**Pemakaian di Service**:
```typescript
export class LeaveService {
  @Cached({ ttlMs: 300_000, keyPrefix: 'leave_types', companyScoped: true })
  async findAllLeaveTypes(companyId: string) {
    return prisma.leaveType.findMany({ where: { companyId, deletedAt: null } });
  }
}
```

**Cache Invalidation via Event Bus**: Semua mutation (create/update/delete leave type) akan publish event → subscriber hapus semua cache keys prefix `hrms:cache:v1:leave_types:<companyId>:*` dengan Redis SCAN + DEL atomic Lua script.

---

### 3.2 Query Optimization — Prisma Deep Include Audit + Projection (Select Only Needed Fields)

Masalah N+1 dan overfetching: employee detail 7 tabs → 1 query findMany employees dengan `include: { department: true, position: true, salaries: true, benefitEnrollments: true, leaveBalances: true, ... SEMUA RELATION}` padahal List Page hanya butuh 5 field.

**Solusi**: DTO Query parameter `include` projection + explicit `select`:

```typescript
// employee.repository.ts findAll
async findAll(query: EmployeeQueryDTO) {
  const { companyId, departmentId, positionId, status, search, page, limit } = query;

  // PENTING: List page HANYA select field yang ditampilkan di table.
  // JANGAN include relasi yang tidak dibutuhkan!
  const select = Prisma.validator<Prisma.EmployeeSelect>()({
    id: true,
    employeeNumber: true,
    firstName: true,
    lastName: true,
    fullName: true,
    email: true,
    avatar: true,
    joinDate: true,
    employmentType: true,
    employmentStatus: true,
    employeeCategory: true,
    // Include HANYA 1 nested object nama department, position, branch — full object tidak perlu
    department: { select: { id: true, name: true, code: true } },
    position: { select: { id: true, name: true, gradeLevel: true } },
    branch: { select: { id: true, name: true } },
  });

  const where: Prisma.EmployeeWhereInput = { companyId, deletedAt: null };
  if (departmentId) where.departmentId = departmentId;
  if (positionId) where.positionId = positionId;
  if (status) where.employmentStatus = status as EmploymentStatus;
  if (search) {
    where.OR = [
      { employeeNumber: { contains: search, mode: 'insensitive' } },
      { fullName: { contains: search, mode: 'insensitive' } },
      { email: { contains: search, mode: 'insensitive' } },
    ];
  }

  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      select, // <-- projection SELECT kolom minimal, bukan *
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
  ]);

  return { rows, total, page, limit, totalPages: Math.ceil(total / limit) };
}
```

**Catatan Penting**: Detail page employee baru include semua relasi (family, education, dll). List page TIDAK PERNAH include 10 relasi → performance order of magnitude lebih cepat.

---

### 3.3 Payroll Run Async Queue dengan BullMQ + Progress Tracking

Refactor `PayrollService.createPayrollRun()` async:

```typescript
// payroll.service.ts — entry point (async return jobId, tidak wait sampai selesai)
async createPayrollRunAsync(dto: CreatePayrollRunDTO, userId: string) {
  const run = await this.createPayrollRunHeader(dto, userId); // status = PROCESSING

  // Dispatch BullMQ job, chunk by 50 employee per job
  const allActiveEmployees = await prisma.employee.findMany({
    where: { companyId: dto.companyId, employmentStatus: 'ACTIVE', deletedAt: null },
    select: { id: true },
  });

  const CHUNK = 50;
  const totalChunks = Math.ceil(allActiveEmployees.length / CHUNK);

  await prisma.payrollRun.update({
    where: { id: run.id },
    data: { totalEmployees: allActiveEmployees.length, status: 'PROCESSING' },
  });

  for (let i = 0; i < totalChunks; i++) {
    const chunk = allActiveEmployees.slice(i * CHUNK, (i + 1) * CHUNK).map(e => e.id);
    queueManager.getQueue(QueueNames.PAYROLL_PROCESSING).add(`payroll-chunk-${run.id}-${i}`, {
      payrollRunId: run.id,
      companyId: dto.companyId,
      periodId: dto.periodId,
      employeeIds: chunk,
      chunkIndex: i,
      totalChunks,
      triggeredBy: userId,
    });
  }

  return run; // langsung return tanpa menunggu. Frontend poll progress.
}

// Progress endpoint
async getPayrollRunProgress(runId: string) {
  const key = `hrms:payroll:progress:${runId}`;
  const progressStr = await redisCache.get(key);
  const progress = progressStr ? JSON.parse(progressStr) : { processed: 0, total: 0, errors: [] };
  const run = await prisma.payrollRun.findUnique({ where: { id: runId } });
  return { ...progress, runStatus: run?.status, totalRupiahNetPay: run?.totalNetPay?.toString() };
}

// ==== WORKER SIDE: queueManager.createWorker PAYROLL_PROCESSING ====
// Setiap chunk proses 50 employee, update progress Redis counter atomic INCRBY
```

---

### 3.4 Frontend Bundle Optimization — Code Splitting + Lazy Per Route

Modifikasi `frontend/src/routes/index.tsx`:

```tsx
import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { DashboardLayout } from '@/layouts/DashboardLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import PageSkeleton from '@/components/shared/PageSkeleton'; // Skeleton global

// LAZY LOAD SEMUA PAGE COMPONENTS — bukan eager import
const LoginPage = lazy(() => import('@/modules/auth/LoginPage'));
const EmployeeListPage = lazy(() => import('@/modules/employee/pages/EmployeeListPage'));
const EmployeeDetailPage = lazy(() => import('@/modules/employee/pages/EmployeeDetailPage'));
const PayrollDashboard = lazy(() => import('@/modules/payroll/pages/PayrollDashboard'));
// ... 20+ halaman LAZY SEMUA

const ProtectedRoute = lazy(() => import('./ProtectedRoute'));

export const router = createBrowserRouter([
  {
    path: '/',
    element: <ProtectedRoute><DashboardLayout /></ProtectedRoute>,
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: 'dashboard', element: <Suspense fallback={<PageSkeleton />}><DashboardPage /></Suspense> },
      {
        path: 'employees',
        children: [
          { index: true, element: <Suspense fallback={<PageSkeleton />}><EmployeeListPage /></Suspense> },
          { path: ':id', element: <Suspense fallback={<PageSkeleton />}><EmployeeDetailPage /></Suspense> },
        ],
      },
      // ... routes lain semua dibungkus Suspense + lazy
    ],
  },
  // Auth routes
  {
    path: '/auth',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Suspense fallback={<PageSkeleton />}><LoginPage /></Suspense> },
    ],
  },
]);
```

**Install Rollup Visualizer** untuk identifikasi large modules:
```bash
cd frontend && npm install -D rollup-plugin-visualizer
```

Tambahkan di `vite.config.ts`:
```typescript
import { visualizer } from 'rollup-plugin-visualizer';
export default defineConfig({
  plugins: [
    react(),
    visualizer({ filename: 'dist/bundle-stats.html', open: true, gzipSize: true }),
  ],
});
```

Jalankan `npm run build` → browser terbuka `bundle-stats.html` → cari chunk terbesar > 100KB gzip. Common offenders: `xlsx`, `jspdf`, `@tanstack/table` — lazy load `import()` hanya saat user click export button, bukan di mount page.

---

## Bagian 4: Testing Foundation & QA Automation

### 4.1 Jest Backend Test Setup — Critical Path First

**Contoh test file `backend/src/modules/auth/auth.service.spec.ts`** — happy path + edge:

```typescript
import { Test } from '@nestjs/testing'; // Jika tidak pakai NestJS, bisa plain new AuthService mock dependency
import { AuthService } from './auth.service';
import { authRepository } from './auth.repository';
import { prisma } from '@/shared/database/prisma';
import { passwordHandler } from '@/shared/security/PasswordHandler';
import { ForbiddenError, AuthError, TooManyRequestsError } from '@/shared/exceptions/AppError';

// Mock semua external dependency: redis, eventBus, prisma kecuali unit test pure
jest.mock('@/infrastructure/cache/RedisCache', () => ({ redisCache: { get: jest.fn(), set: jest.fn(), ping: jest.fn() } }));
jest.mock('@/shared/events/EventBus', () => ({ eventBus: { publish: jest.fn() } }));

describe('AuthService.login()', () => {
  const service = new AuthService();
  const mockUser = {
    id: 'user-123',
    email: 'test@hrms.com',
    status: 'ACTIVE',
    passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$...', // hash dari "Password@123"
    lockedUntil: null,
    mustChangePassword: false,
    employeeId: 'emp-001',
    employee: { fullName: 'Test User', companyId: 'comp-1', company: { groupId: 'grp-1' } },
    userRoles: [{ scopeType: 'COMPANY', companyId: 'comp-1', role: { code: 'COMPANY_ADMIN', rolePermissions: [] } }],
    companyAccesses: [],
  };

  beforeEach(() => { jest.clearAllMocks(); });

  it('HARUS return access + refresh token jika email + password benar', async () => {
    authRepository.findUserByEmail = jest.fn().mockResolvedValue(mockUser);
    passwordHandler.verify = jest.fn().mockResolvedValue(true);

    const result = await service.login({ email: 'test@hrms.com', password: 'Password@123' }, '127.0.0.1');

    expect(result.accessToken).toBeDefined();
    expect(result.refreshToken).toBeDefined();
    expect(result.user.email).toBe('test@hrms.com');
    expect(passwordHandler.verify).toHaveBeenCalledTimes(1);
  });

  it('HARUS throw AuthError jika password salah', async () => {
    authRepository.findUserByEmail = jest.fn().mockResolvedValue(mockUser);
    passwordHandler.verify = jest.fn().mockResolvedValue(false);

    await expect(service.login({ email: 'test@hrms.com', password: 'salah' }, '127.0.0.1'))
      .rejects.toThrow(AuthError);
  });

  it('HARUS throw TooManyRequestsError jika account masih locked', async () => {
    const lockedUser = { ...mockUser, lockedUntil: new Date(Date.now() + 60_000) };
    authRepository.findUserByEmail = jest.fn().mockResolvedValue(lockedUser);
    await expect(service.login({ email: 'test@hrms.com', password: 'Password@123' }, '127.0.0.1'))
      .rejects.toThrow(TooManyRequestsError);
  });
});
```

Jalankan: `cd backend && npx jest auth.service.spec --coverage` → lihat % lines, branches, functions coverage.

### 4.2 Frontend Vitest Form Validation Test

```tsx
// frontend/modules/employee/__tests__/EmployeeFormPage.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmployeeFormPage from '../pages/EmployeeFormPage';
import { QueryClientProvider } from '@tanstack/react-query';
import { testQueryClient } from 'tests/utils';

describe('Employee Form — Required Fields Validation', () => {
  it('Menampilkan error message untuk field kosong saat submit tanpa isi', async () => {
    render(
      <QueryClientProvider client={testQueryClient}>
        <EmployeeFormPage />
      </QueryClientProvider>
    );

    const submitBtn = screen.getByRole('button', { name: /simpan/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      // Nama depan required
      expect(screen.getByText(/first name wajib diisi/i)).toBeInTheDocument();
      // Company ID required
      expect(screen.getByText(/company wajib dipilih/i)).toBeInTheDocument();
    });
  });

  it('Menampilkan error format email invalid', async () => {
    render(/* wrapper */ <EmployeeFormPage />);
    const emailInput = screen.getByLabelText(/email/i);
    fireEvent.change(emailInput, { target: { value: 'bukan-email' } });
    fireEvent.click(screen.getByRole('button', { name: /simpan/i }));
    await waitFor(() => {
      expect(screen.getByText(/format email tidak valid/i)).toBeInTheDocument();
    });
  });
});
```

---

## Bagian 5: Docker & Production Hardening

### 5.1 Dockerfile Multi-stage + Non-Root User

```dockerfile
# backend/Dockerfile — production optimized

### ============ STAGE 1: BUILDER ============
FROM node:20-alpine AS builder
WORKDIR /app

# Install build dependencies (native modules untuk argon2, bcrypt butuh build tools)
RUN apk add --no-cache python3 make g++

# Cache dependency layer
COPY package*.json ./
RUN npm ci --only=production=false

# Copy source & build TS
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma/
RUN npm run build && npm run prisma:generate

### ============ STAGE 2: RUNTIME (distroless / slim non-root) ============
FROM node:20-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app

# Install hanya dependencies runtime (hilangkan devDeps)
COPY --from=builder /app/package*.json ./
RUN npm ci --only=production \
  && npm cache clean --force

# Non-root security: buat user & group terpisah, UID 1001 (tidak default 1000 node)
RUN groupadd -r hris && useradd -r -g hris -u 1001 -m -d /app hris \
  && mkdir -p /app/uploads /app/logs \
  && chown -R hris:hris /app

COPY --from=builder --chown=hris:hris /app/dist ./dist
COPY --from=builder --chown=hris:hris /app/node_modules/.prisma ./node_modules/.prisma

# HEALTHCHECK interval 10s, timeout 3s, retries 3, start-period 30s
HEALTHCHECK --interval=10s --timeout=3s --start-period=30s --retries=3 \
  CMD curl -fsS http://localhost:3000/health || exit 1

USER hris:hris # NEVER RUN AS ROOT
EXPOSE 3000

# Graceful shutdown: handle SIGTERM 10s
STOPSIGNAL SIGTERM
CMD ["node", "dist/index.js"]
```

### 5.2 Docker Compose Production Minimal (Staging)

```yaml
# docker-compose.prod.yml
services:
  api:
    build: ./backend
    restart: unless-stopped
    ports: ["3000:3000"]
    environment:
      DATABASE_URL: mysql://user:${DB_PASS}@db:3306/hris?connection_limit=40&pool_timeout=10
      REDIS_URL: redis://redis:6379/0
      RABBITMQ_URL: amqp://hris:${RABBIT_PASS}@rabbitmq:5672
      NODE_ENV: production
      JWT_ACCESS_SECRET: ${JWT_ACCESS_SECRET}
      JWT_REFRESH_SECRET: ${JWT_REFRESH_SECRET}
      ENCRYPTION_KEY: ${ENCRYPTION_KEY}
    depends_on: [db, redis, rabbitmq]
    healthcheck: { test: ["CMD", "curl", "-f", "http://localhost:3000/health"], interval: 10s, timeout: 3s }
    deploy:
      replicas: 2
      resources: { limits: { cpus: '2', memory: 2G } }
    logging:
      driver: json-file
      options: { max-size: 10m, max-file: "5" }

  worker:
    build: ./backend
    command: node dist/worker.js
    restart: unless-stopped
    environment: { ... same as api ... }
    deploy: { replicas: 2, resources: { limits: { cpus: '1', memory: 1G } } }
    depends_on: [api]

  db:
    image: mysql:8.0
    command: --default-authentication-plugin=caching_sha2_password --innodb-buffer-pool-size=2G --slow-query-log=1 --long-query-time=2
    restart: unless-stopped
    volumes: [mysql-data:/var/lib/mysql, ./db-init:/docker-entrypoint-initdb.d]
    environment: { MYSQL_ROOT_PASSWORD: ${DB_ROOT_PASS}, MYSQL_DATABASE: hris, MYSQL_USER: hris, MYSQL_PASSWORD: ${DB_PASS} }
    ports: ["3306:3306"] # JANGAN expose di production AWS — security group allow hanya internal

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --maxmemory 512mb --maxmemory-policy allkeys-lru
    restart: unless-stopped
    volumes: [redis-data:/data]

  rabbitmq:
    image: rabbitmq:3.12-management-alpine
    restart: unless-stopped
    volumes: [rabbit-data:/var/lib/rabbitmq]
    environment: { RABBITMQ_DEFAULT_USER: hris, RABBITMQ_DEFAULT_PASS: ${RABBIT_PASS} }
    # Management UI port 15672 — JANGAN expose public!

volumes: { mysql-data: { driver: local }, redis-data: {}, rabbit-data: {} }
```

---

## Bagian 6: Monitoring & Alerting (Ops)

### 6.1 Sentry APM Integration Code Snippet

Backend `app.ts` (HARUS di import PALING ATAS sebelum express):
```typescript
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

if (process.env.SENTRY_DSN && config.app.env !== 'development') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: config.app.env,
    release: 'hris-backend@' + process.env.npm_package_version || '1.0.0',
    integrations: [
      new Sentry.Integrations.Http({ tracing: true }),
      new Sentry.Integrations.Express({ app }),
      nodeProfilingIntegration(),
    ],
    tracesSampleRate: config.app.env === 'production' ? 0.1 : 1.0, // 10% di production
    profilesSampleRate: config.app.env === 'production' ? 0.05 : 1.0,
  });

  // Request handler TERATAS (sebelum route apapun)
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());

  // Error handler TERBAWAH (sebelum global ErrorHandler custom kita)
  app.use(Sentry.Handlers.errorHandler());
}
```

Frontend `main.tsx`:
```tsx
import * as Sentry from '@sentry/react';
import { browserTracingIntegration, replayIntegration } from '@sentry/react';

if (import.meta.env.VITE_SENTRY_DSN && import.meta.env.PROD) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [browserTracingIntegration(), replayIntegration()],
    environment: import.meta.env.MODE,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0, // Session replay HANYA saat error
    beforeSend(event, hint) {
      // PII Sanitization: JANGAN kirim email, NIK, phone ke Sentry
      if (event.user) {
        delete event.user.email;
        delete event.user.phone;
      }
      return event;
    },
  });
}
```

---

## Ringkasan Prioritas Implementasi Per Section

| Urutan | Section | Target Close |
|--------|---------|--------------|
| 1 | 1.1 Config Env Validation (no fallback) | Week 0 Day 1 |
| 2 | 1.3 PII Field Encryption | Week 0 Day 2-4 |
| 3 | 1.4 Token Whitelist/Blacklist | Week 0 Day 2 |
| 4 | 2.1 - 2.3 Validator + Zod refine + Unique constraints | Week 1 |
| 5 | 3.2 Query Optimization (select only) + Index migration | Week 0 Day 4 |
| 6 | 1.5 Signed URL Dokumen | Week 1 |
| 7 | 3.1 Service Layer Cache + Invalidasi | Week 4 |
| 8 | 3.3 Payroll Async Queue | Week 5-6 |
| 9 | 2.4 Leave Race Condition Fix | Week 3 |
| 10 | 5.x Docker Security + Production Compose | Week 14 Sebelum Go-Live |

**Semua implementasi di atas WAJIB disertai unit test, integration test, dan manual UAT di staging sebelum merge ke main branch.**
