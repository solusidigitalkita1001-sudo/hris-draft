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

A separate flake is also fixed: the payment-routes HTTP test answered a 500
while an unread request body was still in flight, which let Node reset the
socket under load (`ECONNRESET`, roughly one full run in three). It sends no
body now, and four consecutive full runs pass.
