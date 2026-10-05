import { extractPlaceholders, renderLetter, validateTemplateBody, LETTER_PLACEHOLDERS } from './placeholders';

const context = {
  'employee.fullName': 'Siti Rahayu',
  'employee.employeeNumber': 'EMP-001',
  'company.name': 'PT Contoh',
  'letter.date': '2026-10-05',
};

describe('letter template placeholders', () => {
  it('substitutes the closed set', () => {
    const out = renderLetter(
      'Yang bertanda tangan, {{company.name}}, menerangkan {{employee.fullName}} ({{employee.employeeNumber}}).',
      context,
    );
    expect(out).toBe('Yang bertanda tangan, PT Contoh, menerangkan Siti Rahayu (EMP-001).');
  });

  it('tolerates whitespace inside the braces', () => {
    expect(renderLetter('{{ employee.fullName }}', context)).toBe('Siti Rahayu');
  });

  it('refuses a template naming something the system cannot fill, and says which', () => {
    expect(() => validateTemplateBody('Halo {{employee.salary}} dan {{employee.nope}}'))
      .toThrow(/employee\.salary, employee\.nope/);
  });

  it('refuses an unclosed placeholder instead of printing a brace on a signed letter', () => {
    expect(() => validateTemplateBody('Halo {{employee.fullName}} dan {{company.name')).toThrow(/tidak ditutup/i);
  });

  it('refuses an empty body and an oversized one', () => {
    expect(() => validateTemplateBody('   ')).toThrow(/kosong/i);
    expect(() => validateTemplateBody('x'.repeat(20_001))).toThrow(/batas/i);
  });

  it('accepts a template using only known keys', () => {
    expect(() => validateTemplateBody(
      Object.keys(LETTER_PLACEHOLDERS).map((key) => `{{${key}}}`).join(' '),
    )).not.toThrow();
  });

  describe('is substitution, not a template engine', () => {
    it.each([
      ['an expression', '{{1+1}}'],
      ['a method call', '{{employee.fullName.toUpperCase()}}'],
      ['prototype traversal', '{{employee.constructor.constructor}}'],
      ['a global', '{{process.env.DATABASE_URL}}'],
      ['logic', '{{#if employee}}bocor{{/if}}'],
    ])('neither evaluates nor leaks via %s', (_label, attempt) => {
      // Refused at save time — that is the actual defence.
      expect(() => validateTemplateBody(attempt)).toThrow();
    });

    it('renders an unknown key as empty rather than reaching for it', () => {
      // Belt and braces: even if an unvalidated body reached the renderer, the
      // closed-set check means nothing is resolved by traversing an object.
      const out = renderLetter('[{{process.env.DATABASE_URL}}][{{employee.constructor}}]', {
        ...context, 'process.env.DATABASE_URL': 'mysql://secret', 'employee.constructor': 'leak',
      } as never);
      expect(out).toBe('[][]');
    });
  });

  it('renders a key the employee has no value for as empty, not as a raw placeholder', () => {
    // No NPWP is a real state; printing `{{employee.taxId}}` on a signed
    // letter is worse than printing nothing.
    expect(renderLetter('NPWP: {{employee.taxId}}', context)).toBe('NPWP: ');
  });

  it('lists each distinct placeholder once', () => {
    expect(extractPlaceholders('{{company.name}} {{company.name}} {{letter.date}}'))
      .toEqual(['company.name', 'letter.date']);
  });
});
