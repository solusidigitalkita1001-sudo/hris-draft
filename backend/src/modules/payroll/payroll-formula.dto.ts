import { z } from 'zod';
export const formulaDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Use a valid calendar date');
export const formulaDraftSchema = z.object({
  expression: z.string().trim().min(1).max(2048), effectiveFrom: formulaDateSchema,
}).strip();
const number = z.string().regex(/^(?:0|[1-9]\d{0,12})(?:\.\d{1,6})?$/);
const days = z.string().regex(/^(?:0|[1-9]\d{0,3}|10000)$/);
export const formulaPreviewSchema = z.object({
  inputs: z.object({ BASE_SALARY: number, WORK_DAYS: days, PRESENT_DAYS: days,
    LEAVE_DAYS: days, ABSENT_DAYS: days, OVERTIME_HOURS: number }).strict(),
  componentAmounts: z.record(z.string().regex(/^[A-Za-z0-9_-]{1,50}$/), number).default({}),
}).strip();
export const formulaComponentParams = z.object({ componentId: z.string().uuid() });
export const formulaVersionParams = formulaComponentParams.extend({ versionId: z.string().uuid() });
export type FormulaDraftDTO = z.infer<typeof formulaDraftSchema>;
export type FormulaPreviewDTO = z.infer<typeof formulaPreviewSchema>;
