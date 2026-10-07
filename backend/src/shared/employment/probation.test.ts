import { createOfferSchema } from '@/modules/recruitment/recruitment.dto';
import { PROBATION_MAX_MONTHS } from './probation';
import { PROBATION_MAX_MONTHS as fromContractService } from '@/modules/employee/employment-contract.service';

/**
 * The recruitment offer promises a probation length and the employment
 * contract records it. The offer DTO allowed up to 24 months while the
 * contract service refuses anything over three as a void clause under
 * UU 13/2003 pasal 60 — so a recruiter could put an unlawful probation into an
 * offer letter already sent to a candidate, and the contract layer would then
 * refuse to record what had been promised.
 *
 * This asserts the two layers share one number rather than agreeing today and
 * drifting later.
 */
const offer = (probationMonths: number) => createOfferSchema.safeParse({
  baseSalary: 10_000_000,
  probationMonths,
});

describe('the statutory probation cap', () => {
  it('is the same number everywhere it is enforced', () => {
    expect(PROBATION_MAX_MONTHS).toBe(3);
    expect(fromContractService).toBe(PROBATION_MAX_MONTHS);
  });

  it('lets an offer promise exactly the statutory maximum', () => {
    expect(offer(PROBATION_MAX_MONTHS).success).toBe(true);
    expect(offer(0).success).toBe(true);
  });

  it('refuses an offer promising more than the law allows', () => {
    expect(offer(PROBATION_MAX_MONTHS + 1).success).toBe(false);
    // The ceiling the DTO used to carry.
    expect(offer(24).success).toBe(false);
  });

  it('still refuses a negative probation', () => {
    expect(offer(-1).success).toBe(false);
  });
});
