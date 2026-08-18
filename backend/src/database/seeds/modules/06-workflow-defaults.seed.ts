import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface WorkflowDefaultConfig {
  name: string;
  approvalType: string;
  resource: string;
}

const WORKFLOW_DEFAULTS: WorkflowDefaultConfig[] = [
  { name: 'Leave Request Default', approvalType: 'LEAVE_REQUEST', resource: 'leave' },
  { name: 'Loan Request Default', approvalType: 'LOAN_REQUEST', resource: 'employee-loan' },
  { name: 'Business Trip Default', approvalType: 'BUSINESS_TRIP', resource: 'travel' },
  { name: 'Expense Claim Default', approvalType: 'EXPENSE_CLAIM', resource: 'travel' },
  { name: 'Shift Swap Default', approvalType: 'SHIFT_SWAP', resource: 'work-calendar' },
  { name: 'Overtime Request Default', approvalType: 'OVERTIME_REQUEST', resource: 'attendance' },
];

async function seedWorkflowDefaultsForCompany(companyId: string): Promise<void> {
  for (const config of WORKFLOW_DEFAULTS) {
    const existing = await prisma.workflowTemplate.findFirst({
      where: {
        companyId,
        approvalType: config.approvalType,
        resource: config.resource,
      },
    });

    if (existing) {
      console.log(`  ⏭ Skipping existing: ${config.name} for company ${companyId}`);
      continue;
    }

    await prisma.workflowTemplate.create({
      data: {
        companyId,
        name: config.name,
        approvalType: config.approvalType,
        resource: config.resource,
        description: `Default 2-stage approval for ${config.approvalType}`,
        isActive: true,
        stages: {
          create: [
            {
              name: 'Level 1 Manager Approval',
              level: 1,
              approverType: 'ROLE',
              approverRoleCode: 'MANAGER',
              slaHours: 48,
              allowEscalation: true,
            },
            {
              name: 'Level 2 HR Manager Approval',
              level: 2,
              approverType: 'ROLE',
              approverRoleCode: 'HR_MANAGER',
              slaHours: 24,
              allowEscalation: true,
            },
          ],
        },
      },
    });
    console.log(`  ✅ Created: ${config.name} for company ${companyId}`);
  }
}

export async function seedWorkflowDefaults(): Promise<void> {
  console.log('\n--- Seeding default workflow templates ---\n');

  const companies = await prisma.company.findMany({
    select: { id: true, name: true },
  });

  if (companies.length === 0) {
    console.log('  ⚠ No companies found — skipping workflow default seeding');
    return;
  }

  for (const company of companies) {
    console.log(`\nProcessing company: ${company.name} (${company.id})`);
    await seedWorkflowDefaultsForCompany(company.id);
  }

  console.log('\n✅ Workflow defaults seeding completed');
}
