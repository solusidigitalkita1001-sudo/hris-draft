import fs from 'node:fs';
import path from 'node:path';

function lockingQueries(relativePath: string): string[] {
  const source = fs.readFileSync(path.resolve(process.cwd(), relativePath), 'utf8');
  return source.match(/SELECT[\s\S]*?FOR UPDATE/g) ?? [];
}

describe('leave raw SQL tenant boundary', () => {
  const serviceQueries = lockingQueries('src/modules/leave/leave.service.ts');
  const repositoryQueries = lockingQueries('src/modules/leave/leave.repository.ts');
  const allQueries = [...serviceQueries, ...repositoryQueries];

  it('keeps the complete six-query locking inventory under regression coverage', () => {
    expect(serviceQueries).toHaveLength(4);
    expect(repositoryQueries).toHaveLength(2);
  });

  it.each(allQueries)('pins each SELECT ... FOR UPDATE to company_id', (query) => {
    expect(query).toMatch(/(?:WHERE|AND)\s+company_id\s*=\s*\$\{/i);
  });
});
