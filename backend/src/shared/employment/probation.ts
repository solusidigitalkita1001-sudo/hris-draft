/**
 * UU 13/2003 pasal 60: masa percobaan paling lama tiga bulan.
 *
 * Shared rather than owned by the contract service, because the recruitment
 * offer promises a probation length and the contract records it. When only the
 * contract knew the limit, an offer could promise 24 months — a clause that is
 * void by law, in a document already sent to a candidate — and the contract
 * layer would then refuse to record what had been promised.
 */
export const PROBATION_MAX_MONTHS = 3;
