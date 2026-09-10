const { createHash } = require('node:crypto');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const MIGRATION = '20260903090000_face_match_rate_limit_index';
const INDEX = 'attendance_face_logs_rate_limit_idx';
const COLUMNS = ['company_id', 'employee_id', 'is_face_match', 'created_at'];
const EXPECTED_SQL = 'CREATE INDEX `attendance_face_logs_rate_limit_idx` ON `attendance_face_logs` (`company_id`, `employee_id`, `is_face_match`, `created_at`);';

class RecoveryError extends Error {}

function matchesIndex(rows) {
  return rows.length === COLUMNS.length && rows.every((row, position) =>
    Number(row.sequence) === position + 1
    && row.column_name === COLUMNS[position]
    && Number(row.non_unique) === 1
    && row.prefix_length === null
    && row.sort_order === 'A'
    && row.index_type === 'BTREE'
    && row.is_visible === 'YES');
}

async function history(prisma) {
  return prisma.$queryRawUnsafe(
    'SELECT id, checksum, finished_at, rolled_back_at FROM `_prisma_migrations` WHERE migration_name = ?', MIGRATION,
  );
}

async function indexDefinition(prisma) {
  return prisma.$queryRawUnsafe(`
    SELECT SEQ_IN_INDEX AS sequence, COLUMN_NAME AS column_name,
           NON_UNIQUE AS non_unique, SUB_PART AS prefix_length,
           COLLATION AS sort_order, INDEX_TYPE AS index_type, IS_VISIBLE AS is_visible
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_face_logs' AND INDEX_NAME = ?
    ORDER BY SEQ_IN_INDEX`, INDEX);
}

const isFailed = (row) => row.finished_at === null && row.rolled_back_at === null;

/** Complete only this single-index migration, then let Prisma repair its history. */
async function recoverFaceMatchIndex({ prisma, migrationSql, resolveApplied, log = console.log }) {
  const tables = await prisma.$queryRawUnsafe(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = '_prisma_migrations'`);
  if (!tables.length) {
    log('[face-index recovery] No migration history yet; normal migrate deploy will handle this database.');
    return 'skipped';
  }

  const records = await history(prisma);
  const failed = records.filter(isFailed);
  if (!failed.length) {
    log('[face-index recovery] No unresolved failure for the face-match index.');
    return 'skipped';
  }

  const checksum = createHash('sha256').update(migrationSql).digest('hex');
  if (migrationSql.trim().replace(/\s+/g, ' ') !== EXPECTED_SQL
    || failed.some((row) => row.checksum !== checksum)
    || records.some((row) => row.finished_at !== null)) {
    throw new RecoveryError('Migration SQL/checksum/history differs from the known single-index migration. Inspect the failed migration before resolving it.');
  }

  let index = await indexDefinition(prisma);
  if (index.length && !matchesIndex(index)) {
    throw new RecoveryError(`${INDEX} exists with a different definition. Recovery stopped; no index or migration history was changed.`);
  }
  if (!index.length) {
    const columns = await prisma.$queryRawUnsafe(`
      SELECT COLUMN_NAME AS column_name FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'attendance_face_logs'`);
    if (COLUMNS.some((column) => !columns.some((row) => row.column_name === column))) {
      throw new RecoveryError('attendance_face_logs or its required columns are missing. Restore the prerequisite migration/schema before retrying.');
    }
    log(`[face-index recovery] Creating missing index ${INDEX}.`);
    await prisma.$executeRawUnsafe(migrationSql);
    index = await indexDefinition(prisma);
    if (!matchesIndex(index)) {
      throw new RecoveryError('Index creation could not be verified. Migration remains unresolved.');
    }
  } else {
    log(`[face-index recovery] Existing index ${INDEX} matches all four columns and index attributes.`);
  }

  // Do not DELETE/UPDATE _prisma_migrations or mark an unverified schema applied.
  await resolveApplied();
  const resolved = await history(prisma);
  if (resolved.some(isFailed) || !resolved.some((row) => row.finished_at !== null && row.rolled_back_at === null)) {
    throw new RecoveryError('Prisma did not finish resolving the failed migration. Deployment remains blocked.');
  }
  log(`[face-index recovery] ${MIGRATION} verified and resolved as applied.`);
  return 'applied';
}

async function main() {
  // When streamed with `docker exec ... node -`, require resolves from /app,
  // where the container already has the pinned Prisma client and CLI installed.
  const { PrismaClient } = require('@prisma/client');
  const schema = path.resolve(process.argv[2] || 'src/database/prisma/schema.prisma');
  const migrationSql = readFileSync(path.join(path.dirname(schema), 'migrations', MIGRATION, 'migration.sql'), 'utf8');
  const prisma = new PrismaClient();
  try {
    await recoverFaceMatchIndex({
      prisma,
      migrationSql,
      resolveApplied: () => execFileSync(process.execPath, [
        require.resolve('prisma/build/index.js'), 'migrate', 'resolve', '--applied', MIGRATION, '--schema', schema,
      ], { stdio: 'inherit' }),
    });
  } finally {
    await prisma.$disconnect();
  }
}

// require.main is undefined when this file is streamed via `docker exec node -`,
// so treat "no main module" as direct execution too.
if (require.main === module || require.main === undefined) {
  main().catch((error) => {
    // Avoid dumping connection strings, query parameters, or database log text.
    const code = /^P\d{4}$/.test(error.code || '') ? ` (${error.code})` : '';
    console.error(`[face-index recovery] ${error instanceof RecoveryError ? error.message : `Database/Prisma command failed${code}; migration was not automatically marked applied.`}`);
    process.exitCode = 1;
  });
}

module.exports = { MIGRATION, INDEX, COLUMNS, matchesIndex, recoverFaceMatchIndex };
