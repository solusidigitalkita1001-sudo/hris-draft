import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { returnAssetSchema } from './asset.dto';
import { triggerYearlyAccrualSchema } from '@/modules/leave/leave.dto';

/**
 * Two mutating routes read a request body nothing checked.
 *
 * `returnAssetSchema` existed, was exported and had a DTO type, and the asset
 * routes never imported it — so `POST /:id/return` stored whatever arrived as
 * the condition an asset came back in, into a VarChar(20) with no enum behind
 * it. `POST /leave/balances/accrue` read `req.body.year` with no validator at
 * all, and `runYearlyLeaveAccrual` is typed `number`: a string made
 * `year - 1` NaN and the sweep then ran against every active employee for a
 * NaN year.
 *
 * Asserted against the route sources because what failed was the wiring, not
 * the schema: both schemas were correct and simply unused.
 */
const assetRoutes = readFileSync(join(__dirname, 'asset.routes.ts'), 'utf8');
const leaveRoutes = readFileSync(
  join(__dirname, '..', 'leave', 'leave.routes.ts'), 'utf8');
/** Comments are stripped: prose naming a schema is not a use of it. */
const code = (text: string) => text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');

describe('the asset return route validates its body', () => {
  it('applies returnAssetSchema, not merely exports it', () => {
    const routes = code(assetRoutes);
    const line = routes.split('\n').find((row) => row.includes("'/:id/return'"));
    expect(line).toBeDefined();
    expect(line).toContain('validate(returnAssetSchema)');
  });

  it('accepts only the four conditions an asset can come back in', () => {
    for (const conditionAtReturn of ['GOOD', 'FAIR', 'DAMAGED', 'LOST']) {
      expect(returnAssetSchema.safeParse({
        assignmentId: '11111111-1111-4111-8111-111111111111', conditionAtReturn,
      }).success).toBe(true);
    }
    expect(returnAssetSchema.safeParse({
      assignmentId: '11111111-1111-4111-8111-111111111111', conditionAtReturn: 'HILANG',
    }).success).toBe(false);
  });

  it('requires the assignment the controller reads from the body', () => {
    // The controller takes `assignmentId` from the body and hands it to the
    // repository; the schema never declared it, so nothing checked its shape.
    expect(returnAssetSchema.safeParse({ conditionAtReturn: 'GOOD' }).success).toBe(false);
    expect(returnAssetSchema.safeParse({ assignmentId: 'not-a-uuid', conditionAtReturn: 'GOOD' }).success)
      .toBe(false);
  });
});

describe('the yearly accrual route validates its year', () => {
  it('applies triggerYearlyAccrualSchema', () => {
    const line = code(leaveRoutes).split('\n').find((row) => row.includes("'/balances/accrue'"));
    expect(line).toBeDefined();
    expect(line).toContain('validate(triggerYearlyAccrualSchema)');
  });

  it('refuses a year that would make the sweep run on NaN', () => {
    expect(triggerYearlyAccrualSchema.safeParse({ year: 'abc' }).success).toBe(false);
    expect(triggerYearlyAccrualSchema.safeParse({ year: 1900 }).success).toBe(false);
    expect(triggerYearlyAccrualSchema.safeParse({ year: 2.5 }).success).toBe(false);
  });

  it('still allows the default, which is the current year', () => {
    // The controller falls back to `new Date().getFullYear()` when it is absent.
    expect(triggerYearlyAccrualSchema.safeParse({}).success).toBe(true);
    expect(triggerYearlyAccrualSchema.safeParse({ year: 2026 }).success).toBe(true);
    // A numeric string is the normal shape from a form, so it is coerced
    // rather than rejected.
    expect(triggerYearlyAccrualSchema.safeParse({ year: '2026' })).toMatchObject({
      success: true, data: { year: 2026 },
    });
  });
});
