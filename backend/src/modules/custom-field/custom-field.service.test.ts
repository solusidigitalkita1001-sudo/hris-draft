import { createCustomFieldSchema } from './custom-field.dto';

type Row = Record<string, unknown>;

const state: {
  definitions: Row[];
  existingDefinition: Row | null;
  employee: Row | null;
  values: Row[];
  upserts: Row[];
  deletes: Row[];
} = { definitions: [], existingDefinition: null, employee: null, values: [], upserts: [], deletes: [] };

jest.mock('@/shared/database/prisma', () => {
  const client: Record<string, unknown> = {
    customFieldDefinition: {
      findMany: jest.fn(async () => state.definitions),
      findFirst: jest.fn(async () => state.existingDefinition),
      create: jest.fn(async ({ data }: { data: Row }) => ({ id: 'definition-new', ...data })),
      update: jest.fn(async ({ data }: { data: Row }) => data),
    },
    employee: { findFirst: jest.fn(async () => state.employee) },
    employeeCustomFieldValue: {
      findMany: jest.fn(async () => state.values),
      upsert: jest.fn(async (args: Row) => { state.upserts.push(args); }),
      deleteMany: jest.fn(async (args: Row) => { state.deletes.push(args); }),
    },
  };
  client.$transaction = jest.fn(async (fn: (tx: unknown) => unknown) => fn(client));
  return { __esModule: true, default: client, prisma: client };
});
jest.mock('@/shared/logger/WinstonLogger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock('@/shared/security/employee-data-scope', () => ({ assertEmployeeInScope: jest.fn(async () => undefined) }));

import { customFieldService } from './custom-field.service';

const COMPANY = 'company-a';
const EMPLOYEE = 'employee-1';

function definition(over: Row = {}) {
  return {
    id: 'definition-1', companyId: COMPANY, entity: 'EMPLOYEE', key: 'nomor_seragam',
    label: 'Nomor Seragam', type: 'TEXT', options: null, required: false, isActive: true, sortOrder: 0,
    ...over,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  state.definitions = [definition()];
  state.existingDefinition = null;
  state.employee = { id: EMPLOYEE };
  state.values = [];
  state.upserts = [];
  state.deletes = [];
});

describe('definition contract', () => {
  it('DTO: SELECT needs options, non-SELECT refuses them, key is snake_case', () => {
    expect(createCustomFieldSchema.safeParse({ key: 'golongan', label: 'Golongan', type: 'SELECT' }).success).toBe(false);
    expect(createCustomFieldSchema.safeParse({ key: 'golongan', label: 'Golongan', type: 'TEXT', options: ['A'] }).success).toBe(false);
    expect(createCustomFieldSchema.safeParse({ key: 'Golongan Satu', label: 'Golongan', type: 'TEXT' }).success).toBe(false);
    expect(createCustomFieldSchema.safeParse({ key: 'golongan', label: 'Golongan', type: 'SELECT', options: ['A', 'B'] }).success).toBe(true);
  });

  it('refuses to reuse a key, even a deactivated one — old values still point at it', async () => {
    state.existingDefinition = definition({ isActive: false });
    await expect(customFieldService.createDefinition(COMPANY, {
      key: 'nomor_seragam', label: 'Baru', type: 'TEXT',
    })).rejects.toThrow(/sudah ada \(nonaktif\)/);
  });
});

describe('writing values', () => {
  it('validates per type and stores the canonical text', async () => {
    state.definitions = [
      definition({ id: 'd-number', key: 'tinggi_cm', type: 'NUMBER' }),
      definition({ id: 'd-date', key: 'tanggal_sim', type: 'DATE' }),
      definition({ id: 'd-select', key: 'golongan', type: 'SELECT', options: ['A', 'B'] }),
    ];

    await customFieldService.setValues(COMPANY, EMPLOYEE, {
      values: { tinggi_cm: '172', tanggal_sim: '2026-01-15', golongan: 'B' },
    });

    const written = state.upserts.map((args) => (args as { create: Row }).create);
    expect(written).toEqual(expect.arrayContaining([
      expect.objectContaining({ definitionId: 'd-number', value: '172' }),
      expect.objectContaining({ definitionId: 'd-date', value: '2026-01-15' }),
      expect.objectContaining({ definitionId: 'd-select', value: 'B' }),
    ]));
  });

  it.each([
    ['tinggi_cm', 'NUMBER', 'bukan-angka', /harus angka/],
    ['tanggal_sim', 'DATE', '15/01/2026', /YYYY-MM-DD/],
    ['golongan', 'SELECT', 'C', /salah satu dari/],
  ])('rejects a %s value that fails its %s type', async (key, type, value, message) => {
    state.definitions = [definition({ id: 'd-x', key, type, options: type === 'SELECT' ? ['A', 'B'] : null })];
    await expect(customFieldService.setValues(COMPANY, EMPLOYEE, { values: { [key]: value } }))
      .rejects.toThrow(message);
    expect(state.upserts).toHaveLength(0);
  });

  it('rejects an unknown key instead of inventing a field on the fly', async () => {
    await expect(customFieldService.setValues(COMPANY, EMPLOYEE, { values: { tidak_ada: 'x' } }))
      .rejects.toThrow(/tidak dikenal/);
  });

  it('null clears an optional value and refuses to clear a required one', async () => {
    state.definitions = [
      definition({ id: 'd-optional', key: 'opsional' }),
      definition({ id: 'd-required', key: 'wajib', required: true }),
    ];

    await customFieldService.setValues(COMPANY, EMPLOYEE, { values: { opsional: null } });
    expect(state.deletes).toHaveLength(1);

    await expect(customFieldService.setValues(COMPANY, EMPLOYEE, { values: { wajib: null } }))
      .rejects.toThrow(/wajib diisi/);
  });

  it('404s an employee outside the active company', async () => {
    state.employee = null;
    await expect(customFieldService.setValues(COMPANY, EMPLOYEE, { values: { nomor_seragam: 'X1' } }))
      .rejects.toThrow(/tidak ditemukan/i);
  });
});

describe('reading values', () => {
  it('merges active definitions with stored values, null when unset', async () => {
    state.values = [{ definitionId: 'definition-1', value: 'U-17' }];
    const merged = await customFieldService.valuesFor(COMPANY, EMPLOYEE);
    expect(merged).toEqual([
      expect.objectContaining({ key: 'nomor_seragam', value: 'U-17', required: false }),
    ]);
  });
});
