/**
 * S-M2: `seed.ts` ran the demo test-data seed by default — gated only on the
 * inverse of `SKIP_TEST_DATA` — so a production run that forgot that one env
 * var got a fleet of demo employees (and the shared `Employee123!` password)
 * inserted into a real company's database. This is the hard refusal that
 * replaces that silent default.
 */
export class ProductionTestDataSeedError extends Error {
  constructor(nodeEnv: string) {
    super(
      `Seed data demo (test-data) ditolak: NODE_ENV=${nodeEnv}. ` +
        'Seed ini hanya untuk dev/demo dan tidak boleh berjalan di produksi. ' +
        'Set SKIP_TEST_DATA=1 untuk melewatinya secara eksplisit, atau jalankan di environment non-produksi.'
    );
    this.name = 'ProductionTestDataSeedError';
  }
}

/**
 * Throws when the demo test-data seed must not run (`NODE_ENV=production`).
 * Pure function: no DB access, so it is directly unit-testable.
 */
export function assertTestDataSeedAllowed(nodeEnv: string | undefined = process.env.NODE_ENV): void {
  if (nodeEnv === 'production') {
    throw new ProductionTestDataSeedError(nodeEnv);
  }
}
