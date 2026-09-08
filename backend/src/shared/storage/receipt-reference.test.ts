import { receiptOwnerDirectory, validateReceiptReference } from './receipt-reference';
const company = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const employee = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
const file = 'ffffffff-ffff-ffff-ffff-ffffffffffff.pdf';
const prefix = `/uploads/travel-expenses/receipts/${company}/${employee}/`;
describe('receipt ownership reference', () => {
  it('accepts a receipt uploaded by the claim employee in the active company', () => {
    expect(() => validateReceiptReference(`https://hris.example${prefix}${file}`, company, employee)).not.toThrow();
  });
  it.each([
    `/uploads/travel-expenses/receipts/${file}`,
    prefix.replace(company, employee) + file,
    prefix.replace(employee, company) + file,
    prefix + '../' + file,
    prefix + '%2e%2e%2f' + file,
    prefix + file + '.html',
  ])('rejects forged or unowned reference %s', (reference) => {
    expect(() => validateReceiptReference(reference, company, employee)).toThrow();
  });
  it('rejects traversal in actor identifiers', () => {
    expect(() => receiptOwnerDirectory('../escape', employee)).toThrow();
  });
});
