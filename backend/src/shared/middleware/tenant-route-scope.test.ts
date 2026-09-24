import fs from 'node:fs';
import path from 'node:path';

const TENANT_ROUTES = [
  'audit-log/audit-log.routes.ts',
  'company-settings/company-settings.routes.ts',
  'notification/notification.routes.ts',
  'performance/performance.routes.ts',
  'permission-request/permission-request.routes.ts',
  'rbac/rbac.routes.ts',
  'user/user.routes.ts',
  'work-calendar/work-calendar.routes.ts',
];

describe('tenant route company-context boundary', () => {
  it.each(TENANT_ROUTES)('%s validates the selected company after authentication', (routePath) => {
    const source = fs.readFileSync(
      path.resolve(process.cwd(), 'src/modules', routePath),
      'utf8',
    );

    expect(source).toContain("import { requireCompanyAccess } from '@/shared/middleware/CompanyScope';");
    expect(source).toMatch(/router\.use\(authenticate\);\s*router\.use\(requireCompanyAccess\(\)\);/);
  });
});
