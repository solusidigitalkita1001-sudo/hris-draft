export enum BankProvider {
  BCA_ONLINE = 'BCA_ONLINE',
  MANDIRI_IBANKING = 'MANDIRI_IBANKING',
  BNI_INTERNETBANKING = 'BNI_INTERNETBANKING',
  MT940_SWIFT = 'MT940_SWIFT',
}

export interface ParsedBankTxn {
  dateValue: string | null;
  datePosting: string | null;
  description: string;
  amountInIDR: number;
  isCredit: boolean;
  isDebit: boolean;
  uniqueRef: string;
  balanceAfter: number | null;
  sourceRow: number;
  bank: BankProvider;
}

export interface BankParseResult {
  provider: BankProvider;
  totalRows: number;
  parsedCount: number;
  parsedTxns: ParsedBankTxn[];
  errors: string[];
  ignoredRows: number[];
  summary: {
    totalCredit: number;
    totalDebit: number;
    balanceDelta: number;
    startBalance: number | null;
    endBalance: number | null;
  };
}

export interface PayrollDisbursementExpected {
  employeeId: string;
  employeeName?: string | null;
  bankAccountRef?: string | null;
  bankAccountNumber?: string | null;
  expectedAmount: number;
  externalRef?: string | null;
}

export interface ReconMatchedItem {
  employeeId: string;
  bankTransactionRef: string;
  expectedAmount: number;
  actualAmount: number;
  difference: number;
  exactAmountMatch: boolean;
}

export interface ReconResult {
  totalExpectedDisbursements: number;
  totalBankTxns: number;
  matched: ReconMatchedItem[];
  missingInBank: PayrollDisbursementExpected[];
  extraInBank: ParsedBankTxn[];
  amountDiffSumAbsolute: number;
  matchedAmountPercent: number;
  matchedCountPercent: number;
  fullyReconciled: boolean;
  issues: string[];
}

const BCA_DELIMITER = ',';
const MANDIRI_DELIMITER = ';';
const BNI_DELIMITER = '|';

function stripIDRCurrency(raw: string): number {
  if (raw == null) return 0;
  let s = String(raw).trim();
  if (!s) return 0;
  const originalSign = s.startsWith('-') ? -1 : 1;
  s = s.replace(/^[+-]/, '');
  s = s.replace(/Rp/i, '').replace(/IDR/gi, '').replace(/\s+/g, '');
  if (!s) return 0;
  const hasComma = s.includes(',');
  const hasDot = s.includes('.');
  if (hasComma && hasDot) {
    const lastComma = s.lastIndexOf(',');
    const lastDot = s.lastIndexOf('.');
    if (lastComma > lastDot) {
      s = s.replace(/\./g, '').replace(',', '.');
    } else {
      s = s.replace(/,/g, '');
    }
  } else if (hasComma && !hasDot) {
    if (/,\d{1,2}$/.test(s)) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
  } else if (hasDot && !hasComma) {
    if (/\.\d{1,2}$/.test(s)) s = s;
    else s = s.replace(/\./g, '');
  }
  const match = s.match(/\d+(\.\d+)?/);
  if (!match) return 0;
  const n = Number(match[0]) * originalSign;
  if (!Number.isFinite(n)) return 0;
  return Math.round(n);
}

function parseDateID(raw: string): string | null {
  if (!raw) return null;
  const s = String(raw).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})$/);
  if (m) {
    const day = m[1].padStart(2, '0');
    const month = m[2].padStart(2, '0');
    const y = m[3];
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${month}-${day}`;
  }
  return s;
}

function safeGet<T>(arr: T[], idx: number): T | undefined {
  return arr[idx];
}

export function delimiterForBank(bank: BankProvider): string {
  switch (bank) {
    case BankProvider.BCA_ONLINE:
      return BCA_DELIMITER;
    case BankProvider.MANDIRI_IBANKING:
      return MANDIRI_DELIMITER;
    case BankProvider.BNI_INTERNETBANKING:
      return BNI_DELIMITER;
    case BankProvider.MT940_SWIFT:
      return '\n';
  }
}

function splitLineByDelim(line: string, delim: string): string[] {
  if (delim === '\n') return [line];
  const cells: string[] = [];
  let inQuote = false;
  let buf = '';
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuote = !inQuote;
      continue;
    }
    if (ch === delim && !inQuote) {
      cells.push(buf.trim());
      buf = '';
    } else {
      buf += ch;
    }
  }
  cells.push(buf.trim());
  return cells;
}

function mt940ExtractField(block: string, tag: string): string | null {
  const pattern = new RegExp(`(?:^|:)${tag.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&')}:(.*?)(?=\\n:?\\d{1,2}[A-Z]?:|$)`, 'ms');
  const m = block.match(pattern);
  if (!m) return null;
  return (m[1] || '').trim().replace(/\r/g, '');
}

function parseMT940(
  content: string,
  errors: string[],
  ignoredRows: number[],
  txns: ParsedBankTxn[],
): void {
  const tag61Regex = /^:61:(.*(?:\n(?!:\d{1,2}[A-Z]?:).*)*)/gm;
  const statements = content.split(/(?=^:20:)/m);
  let startBalance: number | null = null;
  let endBalance: number | null = null;
  let stmtIdx = 0;

  for (const stmt of statements) {
    if (!stmt.includes(':60F:')) continue;
    const opening = mt940ExtractField(stmt, '60F');
    if (opening) {
      const sign = opening[0];
      const balanceMatch = opening.match(/([0-9,]{1,15})$/);
      if (balanceMatch) {
        const amt = Number(balanceMatch[1].replace(',', '.'));
        startBalance = Number.isFinite(amt) ? (sign === 'D' ? -amt : amt) : 0;
      }
    }
    const closing = mt940ExtractField(stmt, '62F') || mt940ExtractField(stmt, '62M');
    if (closing) {
      const sign = closing[0];
      const balanceMatch = closing.match(/([0-9,]{1,15})$/);
      if (balanceMatch) {
        const amt = Number(balanceMatch[1].replace(',', '.'));
        endBalance = Number.isFinite(amt) ? (sign === 'D' ? -amt : amt) : 0;
      }
    }

    let match: RegExpExecArray | null;
    let txnIdx = 0;
    while ((match = tag61Regex.exec(stmt)) !== null) {
      const body = match[1].replace(/\r/g, '').split('\n').map((l) => l.trim()).join(' ').trim();
      const line = body.split(/\s{2,}|\t| /)[0]?.trim() || body;
      const m = line.match(/^(\d{6})(\d{4})?([CD])([A-Z])?\s*([0-9,]{1,15})([A-Z]{4})?\s*(.*)?$/);
      const fullLine = body;
      const m2 = fullLine.match(/^(\d{6})(\d{4})?([CD])([A-Z])?\s*([0-9,]{1,15})([A-Z]{4})?(.*)$/s);
      const finalMatch = m2 ?? m;
      if (!finalMatch) {
        ignoredRows.push(txnIdx);
        txnIdx++;
        continue;
      }
      const yy = finalMatch[1].substring(0, 2);
      const mm = finalMatch[1].substring(2, 4);
      const dd = finalMatch[1].substring(4, 6);
      const dateValue = `20${yy}-${mm}-${dd}`;
      const datePosting = finalMatch[2]
        ? `20${finalMatch[2].substring(0, 2)}-${finalMatch[2].substring(2, 4)}-${finalMatch[2].substring(4, 6)}`
        : dateValue;
      const isCredit = (finalMatch[3] || 'C') === 'C';
      const amount = Number((finalMatch[5] || '0').replace(',', '.'));
      const desc = (finalMatch[7] || '').trim() || 'MT940 transaksi';
      txns.push({
        dateValue,
        datePosting,
        description: desc,
        amountInIDR: amount,
        isCredit,
        isDebit: !isCredit,
        uniqueRef: `MT940-${stmtIdx}-${txnIdx}`,
        balanceAfter: null,
        sourceRow: txnIdx,
        bank: BankProvider.MT940_SWIFT,
      });
      txnIdx++;
    }
    stmtIdx++;
  }
  if (txns.length > 0 && startBalance !== null && endBalance !== null) {
    let running = startBalance;
    for (const t of txns) {
      running += t.isCredit ? t.amountInIDR : -t.amountInIDR;
      t.balanceAfter = running;
    }
  }
  if (startBalance === null && endBalance === null) {
    errors.push('MT940 tag :60F: opening balance tidak ditemukan atau format salah.');
  }
}

export function parseBankStatement(
  rawContent: string,
  bankProvider: BankProvider,
  options: { skipHeaderN?: number; encodingHint?: string } = {},
): BankParseResult {
  const errors: string[] = [];
  const ignoredRows: number[] = [];
  const txns: ParsedBankTxn[] = [];
  if (!rawContent || typeof rawContent !== 'string') {
    return {
      provider: bankProvider,
      totalRows: 0,
      parsedCount: 0,
      parsedTxns: [],
      errors: ['Input bank statement kosong atau bukan string.'],
      ignoredRows: [],
      summary: { totalCredit: 0, totalDebit: 0, balanceDelta: 0, startBalance: null, endBalance: null },
    };
  }

  const skipHeaderN = options.skipHeaderN ?? 1;
  const delim = delimiterForBank(bankProvider);

  if (bankProvider === BankProvider.MT940_SWIFT) {
    parseMT940(rawContent, errors, ignoredRows, txns);
  } else {
    const lines = rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0);
    for (let idx = 0; idx < lines.length; idx++) {
      const line = lines[idx];
      if (idx < skipHeaderN) {
        ignoredRows.push(idx);
        continue;
      }
      const cells = splitLineByDelim(line, delim);
      let dateValue: string | null = null;
      let datePosting: string | null = null;
      let description = '';
      let amount = 0;
      let isCredit = false;
      let balanceAfter: number | null = null;
      let valid = true;

      switch (bankProvider) {
        case BankProvider.BCA_ONLINE: {
          dateValue = parseDateID(safeGet(cells, 0) || '');
          datePosting = parseDateID(safeGet(cells, 4) || '') || dateValue;
          description = (safeGet(cells, 2) || '').trim();
          const type = String(safeGet(cells, 1) || '').toLowerCase().trim();
          amount = stripIDRCurrency(safeGet(cells, 5) || '0');
          balanceAfter = stripIDRCurrency(safeGet(cells, 5) || '0');
          isCredit = /^(cr|credit)$/.test(type);
          const isDebit = /^(db|debit)$/.test(type);
          if (!isCredit && !isDebit) {
            valid = false;
            break;
          }
          amount = isDebit ? -Math.abs(amount) : Math.abs(amount);
          break;
        }
        case BankProvider.MANDIRI_IBANKING: {
          dateValue = parseDateID(safeGet(cells, 0) || '');
          datePosting = dateValue;
          description = (safeGet(cells, 1) || '').trim();
          const credit = stripIDRCurrency(safeGet(cells, 2) || '0');
          const debit = stripIDRCurrency(safeGet(cells, 3) || '0');
          balanceAfter = stripIDRCurrency(safeGet(cells, 4) || '0');
          if (credit === 0 && debit === 0) {
            valid = false;
            break;
          }
          if (credit > 0 && debit > 0) {
            errors.push(`Row ${idx} header MANDIRI credit dan debit non-zero, ambil credit > debit bila ganda`);
          }
          amount = Math.max(credit, -debit);
          isCredit = credit >= Math.abs(debit) && credit > 0;
          break;
        }
        case BankProvider.BNI_INTERNETBANKING: {
          datePosting = parseDateID(safeGet(cells, 0) || '');
          dateValue = parseDateID(safeGet(cells, 1) || '') || datePosting;
          description = (safeGet(cells, 2) || '').trim();
          const rawAmount = (safeGet(cells, 3) || '0').trim();
          amount = stripIDRCurrency(rawAmount);
          if (rawAmount.startsWith('-') || /DB/i.test(rawAmount)) {
            amount = -Math.abs(amount);
          }
          balanceAfter = stripIDRCurrency(safeGet(cells, 4) || '0');
          isCredit = amount >= 0;
          break;
        }
        default:
          valid = false;
          errors.push(`Bank provider ${bankProvider} belum didukung parse.`);
      }

      if (!valid || !description || (amount === 0 && balanceAfter === 0)) {
        ignoredRows.push(idx);
        continue;
      }

      if (!Number.isFinite(amount)) {
        ignoredRows.push(idx);
        errors.push(`Row ${idx} amount tidak numeric: ${cells.join(' | ')}`);
        continue;
      }
      if (amount < 0 && balanceAfter === 0 && isCredit === false) {
        // Biarkan normal
      }
      txns.push({
        dateValue,
        datePosting,
        description,
        amountInIDR: Math.abs(amount),
        isCredit,
        isDebit: !isCredit,
        uniqueRef: `${bankProvider}-${idx}-${Math.abs(amount).toFixed(0)}-${dateValue ?? 'NA'}`,
        balanceAfter: balanceAfter && Number.isFinite(balanceAfter) ? balanceAfter : null,
        sourceRow: idx,
        bank: bankProvider,
      });
    }
  }

  let totalCredit = 0;
  let totalDebit = 0;
  let startBalance: number | null = null;
  let endBalance: number | null = null;
  for (const t of txns) {
    if (t.isCredit) totalCredit += t.amountInIDR;
    else totalDebit += t.amountInIDR;
  }
  if (txns.length > 0) {
    const first = txns[0];
    endBalance = txns[txns.length - 1].balanceAfter ?? null;
    if (first.balanceAfter != null) {
      startBalance = first.isCredit ? first.balanceAfter - first.amountInIDR : first.balanceAfter + first.amountInIDR;
    }
  }

  return {
    provider: bankProvider,
    totalRows: bankProvider === BankProvider.MT940_SWIFT ? txns.length + ignoredRows.length : rawContent.split(/\r?\n/).filter((l) => l.trim().length > 0).length,
    parsedCount: txns.length,
    parsedTxns: txns,
    errors,
    ignoredRows,
    summary: {
      totalCredit,
      totalDebit,
      balanceDelta: totalCredit - totalDebit,
      startBalance,
      endBalance,
    },
  };
}

export function reconcileBankToDisbursement(
  bankTxns: ParsedBankTxn[],
  disbursements: PayrollDisbursementExpected[],
  toleranceIDR: number = 500,
): ReconResult {
  const issues: string[] = [];
  const matched: ReconMatchedItem[] = [];
  const usedTxnRefs = new Set<string>();
  const sortedDisb = [...disbursements].sort((a, b) => b.expectedAmount - a.expectedAmount);

  for (const d of sortedDisb) {
    let matchTxn: ParsedBankTxn | null = null;
    for (const t of bankTxns) {
      if (usedTxnRefs.has(t.uniqueRef)) continue;
      if (!t.isCredit) continue;
      if (t.amountInIDR === 0) continue;
      const diff = Math.abs(t.amountInIDR - d.expectedAmount);
      if (diff <= toleranceIDR) {
        if (!matchTxn || diff < Math.abs(matchTxn.amountInIDR - d.expectedAmount)) {
          matchTxn = t;
        }
      }
    }
    if (matchTxn) {
      usedTxnRefs.add(matchTxn.uniqueRef);
      matched.push({
        employeeId: d.employeeId,
        bankTransactionRef: matchTxn.uniqueRef,
        expectedAmount: d.expectedAmount,
        actualAmount: matchTxn.amountInIDR,
        difference: matchTxn.amountInIDR - d.expectedAmount,
        exactAmountMatch: matchTxn.amountInIDR === d.expectedAmount,
      });
    }
  }

  const missingInBank = disbursements.filter((d) => !matched.some((m) => m.employeeId === d.employeeId));
  const extraInBank = bankTxns.filter((t) => t.isCredit && !usedTxnRefs.has(t.uniqueRef));

  const totalExpectedAmount = disbursements.reduce((a, b) => a + b.expectedAmount, 0);
  const matchedAmt = matched.reduce((a, b) => a + b.actualAmount, 0);
  const matchedAmountPercent = totalExpectedAmount > 0 ? Math.round((matchedAmt / totalExpectedAmount) * 10000) / 100 : 0;
  const matchedCountPercent = disbursements.length > 0 ? Math.round((matched.length / disbursements.length) * 10000) / 100 : 0;
  const amountDiffSumAbsolute = matched.reduce((a, b) => a + Math.abs(b.difference), 0);

  if (missingInBank.length) issues.push(`${missingInBank.length} disbursement tidak match di bank statement.`);
  if (extraInBank.length) issues.push(`${extraInBank.length} credit transaksi di bank tidak punya expected disbursement (extra).`);
  if (amountDiffSumAbsolute > 0) issues.push(`Total absolute difference IDR ${amountDiffSumAbsolute.toLocaleString('id-ID')} antara expected vs actual.`);

  return {
    totalExpectedDisbursements: disbursements.length,
    totalBankTxns: bankTxns.length,
    matched,
    missingInBank,
    extraInBank,
    amountDiffSumAbsolute,
    matchedAmountPercent,
    matchedCountPercent,
    fullyReconciled: missingInBank.length === 0 && extraInBank.length === 0 && amountDiffSumAbsolute === 0,
    issues,
  };
}
