import {
  assessEwaRequest,
  calcMaxAllowedEwa,
  isStatusTransitionValid,
  aggregateEwaForPayroll,
} from './ewa-mvp';

describe('C.4 EWA MVP employer-funded float pure functions', () => {
  it('C.4 CASE1: earned 10jt, default 50% percent => max 5jt allowed; remaining 5jt', () => {
    const res = assessEwaRequest(10_000_000, 3_000_000);
    expect(res.maxAllowedAmount).toBe(5_000_000);
    expect(res.isAllowed).toBe(true);
    expect(res.remainingAvailableAfter).toBe(2_000_000);
  });

  it('C.4 CASE2: request 6jt melebihi sisa 5jt => isAllowed false + reason disertakan', () => {
    const res = assessEwaRequest(10_000_000, 6_000_000);
    expect(res.isAllowed).toBe(false);
    expect(res.reason).toBeTruthy();
    expect(res.maxAllowedAmount).toBe(5_000_000);
    expect(res.remainingAvailableAfter).toBe(5_000_000);
  });

  it('C.4 CASE3: existing approved 2jt + request 3jt = 5jt pas 50% => isAllowed true remainingAfter=0', () => {
    const res = assessEwaRequest(10_000_000, 3_000_000, 2_000_000);
    expect(res.isAllowed).toBe(true);
    expect(res.totalApprovedSamePeriod).toBe(2_000_000);
    expect(res.remainingAvailableAfter).toBe(0);
  });

  it('C.4 CASE4: guard edge: request 0 => tidak diizinkan; earned 0 => tidak bisa request; calcMaxAllowed percent>100 auto clamp default 50%', () => {
    const zeroReq = assessEwaRequest(10_000_000, 0);
    expect(zeroReq.isAllowed).toBe(false);
    expect(zeroReq.reason).toContain('tidak boleh 0');
    const zeroEarn = assessEwaRequest(0, 2_000_000);
    expect(zeroEarn.isAllowed).toBe(false);
    expect(zeroEarn.reason).toContain('Belum ada earned');
    const weirdPercent = calcMaxAllowedEwa(10_000_000, 250);
    expect(weirdPercent.max).toBe(5_000_000);
    // negative guard: clamp ke 0
    const neg = calcMaxAllowedEwa(-5_000_000, 50);
    expect(neg.max).toBe(0);
  });

  it('C.4 CASE5: isStatusTransitionValid machine & aggregate EWA deduction payroll component code EWA-DEDUCT tepat', () => {
    // PENDING -> APPROVED = OK
    expect(isStatusTransitionValid({ fromStatus: 'PENDING', toStatus: 'APPROVED' }).allowed).toBe(true);
    // PENDING -> DEDUCTED = SALAH (tidak lewat PAID)
    expect(isStatusTransitionValid({ fromStatus: 'PENDING', toStatus: 'DEDUCTED' }).allowed).toBe(false);
    // FINAL DEDUCTED -> PAID = FALSE (final status)
    expect(isStatusTransitionValid({ fromStatus: 'DEDUCTED', toStatus: 'PAID' }).allowed).toBe(false);

    const list = [
      { id: 'ewa1', employeeId: 'emp1', amountRequested: 2_000_000, amountPaidOut: 2_000_000, status: 'PAID' as const },
      { id: 'ewa2', employeeId: 'emp1', amountRequested: 1_000_000, amountPaidOut: null, status: 'APPROVED' as const }, // belum dibayar, TIDAK di deduct
      { id: 'ewa3', employeeId: 'emp2', amountRequested: 500_000, amountPaidOut: 500_000, status: 'PAID' as const },
    ];
    const deduct = aggregateEwaForPayroll(list);
    expect(deduct.length).toBe(2); // ewa2 STATUS APPROVED tidak di-include
    expect(deduct[0].componentCode).toBe('EWA-DEDUCT');
    expect(deduct[0].employeeId).toBe('emp1');
    expect(deduct[1].deductedAmount).toBe(500_000);
  });
});
