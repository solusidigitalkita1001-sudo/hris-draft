const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MIGRATION, INDEX, COLUMNS, recoverFaceMatchIndex } = require('../migrations/recover-face-match-rate-limit-index.cjs');

const migrationSql = readFileSync(path.join(__dirname, '../../backend/src/database/prisma/migrations', MIGRATION, 'migration.sql'), 'utf8');
const checksum = createHash('sha256').update(migrationSql).digest('hex');
const correctIndex = () => COLUMNS.map((column_name, position) => ({
  column_name, sequence: BigInt(position + 1), non_unique: 1n,
  prefix_length: null, sort_order: 'A', index_type: 'BTREE', is_visible: 'YES',
}));

function fixture(options = {}) {
  const state = {
    historyExists: true,
    records: [{ id: 'failed', checksum, finished_at: null, rolled_back_at: null }],
    index: correctIndex(),
    columns: COLUMNS.map((column_name) => ({ column_name })),
    writes: [], resolves: 0,
    ...options,
  };
  const prisma = {
    async $queryRawUnsafe(sql, value) {
      if (sql.includes('INFORMATION_SCHEMA.TABLES')) return state.historyExists ? [{ TABLE_NAME: '_prisma_migrations' }] : [];
      if (sql.includes('FROM `_prisma_migrations`')) { assert.equal(value, MIGRATION); return structuredClone(state.records); }
      if (sql.includes('INFORMATION_SCHEMA.STATISTICS')) { assert.equal(value, INDEX); return structuredClone(state.index); }
      if (sql.includes('INFORMATION_SCHEMA.COLUMNS')) return state.columns;
      assert.fail(`Unexpected SQL: ${sql}`);
    },
    async $executeRawUnsafe(sql) {
      state.writes.push(sql);
      if (state.createError) throw new Error('DDL permission denied');
      assert.equal(sql, migrationSql);
      state.index = state.createdIndex || correctIndex();
    },
  };
  const run = (overrides = {}) => recoverFaceMatchIndex({
    prisma, migrationSql, log: () => {},
    hasPrerequisiteMigration: state.hasPrerequisiteMigration ?? true,
    resolveApplied: async () => {
      state.resolves++;
      if (state.resolveError) throw new Error('Prisma resolve failed');
      if (state.leaveUnresolved) return;
      state.records[0].rolled_back_at = new Date();
      state.records.push({ id: 'resolved', checksum, finished_at: new Date(), rolled_back_at: null });
    },
    resolveRolledBack: async () => {
      state.rollbackResolves = (state.rollbackResolves || 0) + 1;
      if (state.resolveError) throw new Error('Prisma resolve failed');
      if (state.leaveUnresolved) return;
      state.records[0].rolled_back_at = new Date();
    },
    ...overrides,
  });
  return { state, run };
}

test('existing exact index is resolved without repeating CREATE or deleting history', async () => {
  const { state, run } = fixture();
  assert.equal(await run(), 'applied');
  assert.deepEqual(state.writes, []);
  assert.equal(state.resolves, 1);
  assert.equal(state.records.length, 2);
  assert.equal(await run(), 'skipped');
  assert.equal(state.resolves, 1);
});

test('missing index is created from the unchanged migration SQL, verified, then resolved', async () => {
  const { state, run } = fixture({ index: [] });
  assert.equal(await run(), 'applied');
  assert.deepEqual(state.writes, [migrationSql]);
  assert.equal(state.resolves, 1);
});

for (const [name, options] of Object.entries({
  'new database': { historyExists: false },
  'pending migration': { records: [] },
  'already applied migration': { records: [{ checksum, finished_at: new Date(), rolled_back_at: null }] },
  'rolled back migration': { records: [{ checksum, finished_at: null, rolled_back_at: new Date() }] },
})) {
  test(`${name} remains owned by normal migrate deploy`, async () => {
    const { state, run } = fixture(options);
    assert.equal(await run(), 'skipped');
    assert.equal(state.resolves, 0);
    assert.deepEqual(state.writes, []);
  });
}

for (const [name, mutate] of Object.entries({
  'wrong column': (rows) => { rows[0].column_name = 'attendance_id'; },
  'wrong order': (rows) => { rows.reverse(); },
  'unique index': (rows) => { rows[0].non_unique = 0; },
  'prefix index': (rows) => { rows[0].prefix_length = 10; },
  'descending index': (rows) => { rows[0].sort_order = 'D'; },
  'invisible index': (rows) => { rows[0].is_visible = 'NO'; },
  'wrong index type': (rows) => { rows[0].index_type = 'HASH'; },
  'partial index': (rows) => { rows.pop(); },
  'extra column': (rows) => { rows.push({ ...rows[0], sequence: 5 }); },
})) {
  test(`${name} stops before DDL or resolving history`, async () => {
    const index = correctIndex();
    mutate(index);
    const { state, run } = fixture({ index });
    await assert.rejects(run(), /different definition/);
    assert.deepEqual(state.writes, []);
    assert.equal(state.resolves, 0);
  });
}

test('missing table without the prerequisite migration does not get marked applied', async () => {
  const { state, run } = fixture({ index: [], columns: [], hasPrerequisiteMigration: false });
  await assert.rejects(run(), /required columns are missing/);
  assert.deepEqual(state.writes, []);
  assert.equal(state.resolves, 0);
});

test('missing table with the prerequisite migration is resolved rolled back, no DDL', async () => {
  const { state, run } = fixture({ index: [], columns: [] });
  assert.equal(await run(), 'rolled-back');
  assert.deepEqual(state.writes, []);
  assert.equal(state.resolves, 0);
  assert.equal(state.rollbackResolves, 1);
  assert.equal(await run(), 'skipped');
});

test('a rollback that does not stick keeps the deployment blocked', async () => {
  const { state, run } = fixture({ index: [], columns: [], leaveUnresolved: true });
  await assert.rejects(run(), /did not finish rolling back/);
  assert.deepEqual(state.writes, []);
  assert.equal(state.resolves, 0);
});

test('changed SQL, mismatched checksum and contradictory successful history are refused', async () => {
  for (const options of [
    { records: [{ checksum: 'different', finished_at: null, rolled_back_at: null }] },
    { records: [{ checksum, finished_at: null, rolled_back_at: null }, { checksum, finished_at: new Date(), rolled_back_at: null }] },
  ]) {
    const { state, run } = fixture(options);
    await assert.rejects(run(), /SQL\/checksum\/history differs/);
    assert.equal(state.resolves, 0);
    assert.deepEqual(state.writes, []);
  }
  const { state, run } = fixture();
  await assert.rejects(run({ migrationSql: `${migrationSql}\nDROP TABLE employees;` }), /SQL\/checksum\/history differs/);
  assert.equal(state.resolves, 0);
});

test('DDL failure leaves the migration failed for a later retry', async () => {
  const { state, run } = fixture({ index: [], createError: true });
  await assert.rejects(run(), /permission denied/);
  assert.equal(state.resolves, 0);
  assert.equal(state.records[0].finished_at, null);
});

test('a creation result that cannot be verified never gets resolved', async () => {
  const { state, run } = fixture({ index: [], createdIndex: [] });
  await assert.rejects(run(), /could not be verified/);
  assert.equal(state.resolves, 0);
});

test('Prisma resolve failure is propagated and a subsequent recovery is safe', async () => {
  const { state, run } = fixture({ index: [], resolveError: true });
  await assert.rejects(run(), /Prisma resolve failed/);
  state.resolveError = false;
  assert.equal(await run(), 'applied');
  assert.deepEqual(state.writes, [migrationSql]);
});

test('Prisma must actually resolve the failed record before reporting success', async () => {
  const { run } = fixture({ leaveUnresolved: true });
  await assert.rejects(run(), /did not finish resolving/);
});

test('streaming the file via `node -` (stdin) actually executes main()', () => {
  const { spawnSync } = require('node:child_process');
  const os = require('node:os');
  const source = readFileSync(path.join(__dirname, '../migrations/recover-face-match-rate-limit-index.cjs'), 'utf8');
  // cwd without node_modules: @prisma/client cannot resolve, so a running
  // main() must fail loudly with exit 1 — never a silent exit 0.
  const result = spawnSync(process.execPath, ['-', 'schema.prisma'], { input: source, cwd: os.tmpdir(), encoding: 'utf8' });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /\[face-index recovery\]/);
});
