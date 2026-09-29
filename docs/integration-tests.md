# Real-database integration tests

Nine suites run against a real MySQL database instead of a mocked Prisma
client, because what they check — advisory locks, transaction rollback,
concurrent runs, `SELECT … FOR UPDATE`, data-scope predicates — is behaviour a
mock cannot reproduce. They are gated behind environment variables, so
`npm test` skips them by default and they do not require a database on a
developer machine that does not have one.

Gated is not free: before this pass they had drifted behind the code and four
of the nine failed. Run them when touching payroll, EWA, salary, or data-scope
behaviour.

## Setup

They share one isolated database and refuse to run anywhere else — each suite
asserts the host is local and the database is `hris_payment_integration`, so a
developer database or a deployment cannot be used by accident.

```bash
docker start hris-mysql
docker exec hris-mysql sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" -e "
  CREATE DATABASE IF NOT EXISTS hris_payment_integration;
  GRANT ALL ON hris_payment_integration.* TO \"hris_user\"@\"%\"; FLUSH PRIVILEGES;"'

cd backend
DATABASE_URL='mysql://hris_user:hris_password@127.0.0.1:3307/hris_payment_integration' \
  npx prisma migrate deploy --schema=src/database/prisma/schema.prisma
```

## Running

```bash
cd backend
U='mysql://hris_user:hris_password@127.0.0.1:3307/hris_payment_integration'
RUN_DB_INTEGRATION=1 DATABASE_URL="$U" \
  EWA_ACCESS_DB_URL="$U" PAYROLL_ATTENDANCE_DB_URL="$U" \
  PAYROLL_CALCULATION_DB_URL="$U" PAYROLL_FORMULA_DB_URL="$U" \
  PAYROLL_PAYMENT_DB_URL="$U" PAYROLL_SALARY_DB_URL="$U" \
  PAYROLL_ACCESS_DB_URL="$U" \
  npx jest --runInBand
```

`--runInBand` matters: the suites share one database and clean up their own
synthetic companies in `afterAll`.

| Suite | Env variable | Covers |
|---|---|---|
| `advisory-lock.mysql` | `RUN_DB_INTEGRATION=1` | two concurrent operations serialised on one lock key |
| `ewa-access.mysql` | `EWA_ACCESS_DB_URL` | EWA limit reservation under concurrency and scope |
| `payroll-attendance.mysql` | `PAYROLL_ATTENDANCE_DB_URL` | scheduled dates shared by review/slip/formula, calendar resolution, lateness, overtime |
| `payroll-calculation.mysql` | `PAYROLL_CALCULATION_DB_URL` | atomic runs, rollback, Decimal totals, EWA/loan deduction once |
| `payroll-formula.mysql` | `PAYROLL_FORMULA_DB_URL` | revision publication, cycles, frozen execution evidence |
| `payroll-payment.mysql` | `PAYROLL_PAYMENT_DB_URL` | payment ledger versioning and reconciliation |
| `employee-salary.mysql` | `PAYROLL_SALARY_DB_URL` | salary allocation mutations |
| `employee-salary-read.mysql` | `PAYROLL_SALARY_DB_URL` | salary read access per scope |
| `payroll-run-access.mysql` | `PAYROLL_ACCESS_DB_URL` | run/payslip access per data scope, maker-checker, tenant intersection |
| `reports.mysql` | `RUN_DB_INTEGRATION=1` | agregat headcount/attendance/leave/turnover: angkanya benar dan tidak menghitung baris tenant lain |

## In CI

The `Real-database integration suites (blocking)` job runs the nine suites on
every push and pull request, against a MySQL service database named
`hris_payment_integration` so the suites' own local-and-named guard is
satisfied. It applies the migration chain first, then runs the same selector
used above with `--runInBand`. A failure blocks the merge — these suites drifted
precisely because nothing ran them.

## Modul report (29 September 2026)

Modul `reports` sebelumnya **tidak punya satu pun test**, padahal query-nya
agregat lintas tabel dan kesalahan di situ tidak berbunyi: satu angka muncul di
layar manajemen dan dipercaya. Dua risiko yang paling relevan tidak bisa
direproduksi dengan mock — apakah agregat menghitung baris tenant lain, dan
apakah aritmetikanya cocok dengan baris yang benar-benar ada.

`reports.mysql` membangun dua perusahaan dengan isi yang sengaja dibuat
kembar-bentuk, lalu memeriksa tujuh hal: headcount hanya menghitung perusahaan
aktif dan dikelompokkan seperti yang tampil di layar, filter departemen tidak
bisa dipakai menembus tenant lain (meminta departemen milik tenant lain
menghasilkan nol, bukan barisnya), hitungan kehadiran beserta `lateRate`
turunannya, rentang tanggal di luar jendela dikecualikan, laporan cuti hanya
menghitung yang APPROVED (pengajuan PENDING sengaja ada di fixture dan harus
absen), turnover beserta rekap bulanan, dan dua tenant mendapat angkanya
masing-masing dari query yang sama.

Satu koreksi kecil pada ekspektasi awal saya: field-nya bernama `totalActive`,
bukan `activeCount`, dan `turnover` juga mengembalikan `turnoverRate` serta
`monthly` — test-nya kini mengikat semuanya, bukan hanya yang saya kira ada.

## What this pass found

Running them surfaced two real defects and three stale fixtures.

**Defects**

- `countPayrollAttendance` resolved a date covered by several approved leave
  requests with `Array.prototype.find`, so when a paid and an unpaid request
  overlapped the same date, the unpaid-leave count — and therefore the unpaid
  leave deduction — depended on query order. The same data produced different
  pay between runs. Paid coverage now wins: the day is already excused and
  paid, and a deduction must never hinge on row order.
- The payroll run's as-of salary selection de-duplicates rows per employee
  before the old "multiple active salaries" guard could fire, so two active
  rows sharing the selected effective date were resolved by query order:
  the run silently paid one of two conflicting salaries, or skipped an employee
  because the row it happened to pick was inactive. Rows with *different* dates
  stay unambiguous (as-of picks the latest on or before the period end); rows
  sharing the selected date now raise a conflict naming the date.

**Stale fixtures**

- Self-service payslip history only exposes runs that reached APPROVED or
  DISBURSED. Four cases still expected a COMPLETED run's slip, and one of them
  asserted properties of an empty list, so it passed while checking nothing.
- The payroll formula suite mocked `companySettingsService` without
  `getWorkweekDays`, so a calculation died on "not a function".
- The attendance summary gained `overtimeWorkday`, `overtimeHoliday` and
  `unpaidLeave`; two `toEqual` expectations still described the older shape.

**Found by CI, not locally**

The new job failed on its first run where four local runs had passed: with two
concurrent salary allocations, the loser was rejected with the raw driver error,
so the HTTP boundary answered 500 where a lost race should be a retryable 409.

Identifying it took three attempts worth recording, because each wrong guess
cost a CI round trip:

1. Guessed the race surfaced as Prisma's `P2034`/`P2024`. It did not, and the
   next CI run failed the same way.
2. Added diagnostics with `toMatchObject`, which prints only the keys it
   compares — so the failure still said nothing but `statusCode: undefined`.
3. Threw the details instead, and reproduced it locally by raising contention
   from two racers to eight. The error is **`P2010`** carrying
   `Code: 1213 Deadlock found when trying to get lock`: the company row lock is
   taken by a raw `SELECT … FOR UPDATE`, so a deadlock arrives as a raw-query
   failure rather than Prisma's own conflict code.

All four retry sites — salary allocation, payroll run creation, formula
publication, payment batches — recognised only `P2034`, so each of them leaked
a deadlock as a 500. They now share `isConcurrencyFailure` from
`shared/database/concurrency.ts`, which covers `P2034`, `P2024`, and `P2010`
carrying MySQL 1213/1205. A lost race is retried twice and then reported as a
409; anything that is not a race keeps its own meaning and is never retried.

The eight-racer burst is now a permanent test, because two racers deadlock only
occasionally and that is what let this reach CI unnoticed.

A separate flake is also fixed: the payment-routes HTTP test answered a 500
while an unread request body was still in flight, which let Node reset the
socket under load (`ECONNRESET`, roughly one full run in three). It sends no
body now, and four consecutive full runs pass.
