/**
 * Penyedia pencairan gaji lewat API (GAP-36).
 *
 * Abstraksi tipis di atas "kirim daftar transfer, terima hasil per transfer".
 * Adapter bank nyata (BI-FAST aggregator, Midtrans Iris, OY!, dsb.) butuh
 * kredensial dan kontrak per penyedia — mereka mengimplementasikan interface
 * ini nanti. Yang dikirim v1 adalah SANDBOX: deterministik, dalam proses,
 * tanpa jaringan — supaya seluruh alur batch → submit → hasil → rekonsiliasi
 * bisa dipakai dan diuji sebelum ada kredensial bank.
 *
 * Kontrak hasil: `PAID`/`FAILED` final; `PROCESSING` berarti penyedia akan
 * menjawab belakangan — baris dibiarkan PENDING dan diselesaikan manual lewat
 * jalur record yang ada. Callback webhook menunggu adapter nyata pertama
 * (YAGNI: sandbox selalu sinkron).
 */
export interface DisbursementInstruction {
  referenceNo: string;
  bankCode: string;
  accountNumber: string;
  accountHolder: string;
  /** Nominal persis dalam string desimal; penyedia tidak membulatkan uang. */
  amount: string;
}

export interface DisbursementResult {
  referenceNo: string;
  status: 'PAID' | 'FAILED' | 'PROCESSING';
  providerRef?: string;
  failureReason?: string;
}

export interface DisbursementSubmission {
  providerBatchRef: string;
  results: DisbursementResult[];
}

export interface DisbursementProvider {
  readonly name: string;
  submit(batchRef: string, instructions: DisbursementInstruction[]): Promise<DisbursementSubmission>;
}

/**
 * Sandbox: semua transfer berhasil KECUALI nomor rekening berakhiran '13' —
 * supaya jalur gagal bisa diuji end-to-end dengan sengaja, bukan ditunggu.
 */
export class SandboxDisbursementProvider implements DisbursementProvider {
  readonly name = 'SANDBOX';

  async submit(batchRef: string, instructions: DisbursementInstruction[]): Promise<DisbursementSubmission> {
    return {
      providerBatchRef: `SBX-BATCH-${batchRef}`,
      results: instructions.map((instruction) => instruction.accountNumber.endsWith('13')
        ? { referenceNo: instruction.referenceNo, status: 'FAILED', failureReason: 'Rekening tidak ditemukan (SANDBOX)' }
        : { referenceNo: instruction.referenceNo, status: 'PAID', providerRef: `SBX-${instruction.referenceNo}` }),
    };
  }
}

const PROVIDERS: Record<string, DisbursementProvider> = {
  SANDBOX: new SandboxDisbursementProvider(),
};

/**
 * Referensi bank cadangan saat penyedia tidak mengirim providerRef per baris.
 * HARUS unik per transaksi: `PayrollPaymentTransaction` punya
 * `@@unique([companyId, bankReference])`, dan dua baris PAID dengan referensi
 * yang sama akan meledakkan transaksi ledger SETELAH penyedia memindahkan
 * uang — maka referenceNo baris ikut di dalamnya.
 */
export function fallbackBankReference(providerName: string, providerBatchRef: string, referenceNo: string): string {
  return `${providerName}:${providerBatchRef}:${referenceNo}`;
}

/** Nama dari setting `disbursement_provider` → penyedia, atau null bila tidak dikenal. */
export function resolveDisbursementProvider(name: string | undefined | null): DisbursementProvider | null {
  if (!name) return null;
  return PROVIDERS[name.toUpperCase()] ?? null;
}
