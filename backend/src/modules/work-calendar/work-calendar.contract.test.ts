import { countWorkingDaysQuerySchema, workCalendarIdParamsSchema } from './work-calendar.dto';
describe('working-days API contract', () => {
  it('accepts the calendar ID in the path and only dates in the query', () => {
    expect(workCalendarIdParamsSchema.parse({ id: 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' }).id).toBeDefined();
    expect(countWorkingDaysQuerySchema.parse({ start: '2024-02-29', end: '2024-03-01' })).toEqual({ start: '2024-02-29', end: '2024-03-01' });
  });
  it.each(['2025-02-29', '2026-04-31', '2026-13-01', '2026-00-01'])('rejects impossible date %s', start => {
    expect(countWorkingDaysQuerySchema.safeParse({ start, end: '2027-01-01' }).success).toBe(false);
  });
  it('rejects reversed date ranges', () => {
    expect(countWorkingDaysQuerySchema.safeParse({ start: '2026-03-01', end: '2026-02-01' }).success).toBe(false);
  });
});
