import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

export async function seedTestData(): Promise<void> {
  console.log('\n--- Seeding test data ---\n');

  // ===================================================
  // 1. COMPANY GROUP & COMPANY
  // ===================================================
  console.log('  Creating organization structure...');

  const group = await prisma.companyGroup.upsert({
    where: { code: 'HOLDING' },
    update: {},
    create: { name: 'PT Holding Utama', code: 'HOLDING', taxId: '01.234.567.8-901.000', status: 'ACTIVE' },
  });

  const company = await prisma.company.upsert({
    where: { code: 'TECH' },
    update: {},
    create: {
      groupId: group.id, name: 'PT Teknologi Maju', code: 'TECH',
      taxId: '02.345.678.9-012.000', timezone: 'Asia/Jakarta', currency: 'IDR', status: 'ACTIVE',
    },
  });

  // ===================================================
  // 2. BRANCHES & DIVISIONS
  // ===================================================
  const branch = await prisma.branch.upsert({
    where: { code: 'HQ' },
    update: {}, create: { companyId: company.id, name: 'Head Office Jakarta', code: 'HQ', status: 'ACTIVE' },
  });

  const branch2 = await prisma.branch.upsert({
    where: { code: 'BDG' },
    update: {}, create: { companyId: company.id, name: 'Bandung Branch', code: 'BDG', status: 'ACTIVE' },
  });

  const division = await prisma.division.upsert({
    where: { code: 'OPS' },
    update: {}, create: { companyId: company.id, name: 'Operations', code: 'OPS', status: 'ACTIVE' },
  });

  // ===================================================
  // 3. DEPARTMENTS & POSITIONS
  // ===================================================
  const deptIT = await prisma.department.upsert({
    where: { code: 'IT' },
    update: {}, create: { companyId: company.id, divisionId: division.id, name: 'Information Technology', code: 'IT', status: 'ACTIVE' },
  });

  const deptHR = await prisma.department.upsert({
    where: { code: 'HR' },
    update: {}, create: { companyId: company.id, name: 'Human Resources', code: 'HR', status: 'ACTIVE' },
  });

  const deptFinance = await prisma.department.upsert({
    where: { code: 'FIN' },
    update: {}, create: { companyId: company.id, name: 'Finance & Accounting', code: 'FIN', status: 'ACTIVE' },
  });

  const deptMarketing = await prisma.department.upsert({
    where: { code: 'MKT' },
    update: {}, create: { companyId: company.id, name: 'Marketing', code: 'MKT', status: 'ACTIVE' },
  });

  const posManager = await prisma.position.upsert({
    where: { code: 'MGR' },
    update: {}, create: { companyId: company.id, departmentId: deptIT.id, name: 'Manager', code: 'MGR', gradeLevel: 5, status: 'ACTIVE' },
  });

  const posDev = await prisma.position.upsert({
    where: { code: 'DEV' },
    update: {}, create: { companyId: company.id, departmentId: deptIT.id, name: 'Software Developer', code: 'DEV', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posHR = await prisma.position.upsert({
    where: { code: 'HRSP' },
    update: {}, create: { companyId: company.id, departmentId: deptHR.id, name: 'HR Specialist', code: 'HRSP', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posAcc = await prisma.position.upsert({
    where: { code: 'ACC' },
    update: {}, create: { companyId: company.id, departmentId: deptFinance.id, name: 'Accountant', code: 'ACC', gradeLevel: 3, status: 'ACTIVE' },
  });

  const posMkt = await prisma.position.upsert({
    where: { code: 'MKTS' },
    update: {}, create: { companyId: company.id, departmentId: deptMarketing.id, name: 'Marketing Staff', code: 'MKTS', gradeLevel: 2, status: 'ACTIVE' },
  });

  // ===================================================
  // 4. EMPLOYEES
  // ===================================================
  console.log('  Creating employees...');
  const passwordHash = await bcrypt.hash('Employee123!', 12);

  const employees = [
    { employeeNumber: 'EMP001', firstName: 'Bambang', lastName: 'Supriyadi', email: 'bambang@tech.com', phone: '08123456789', gender: 'Male', position: posManager, dept: deptIT, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP002', firstName: 'Siti', lastName: 'Rahmawati', email: 'siti@tech.com', phone: '08123456790', gender: 'Female', position: posDev, dept: deptIT, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP003', firstName: 'Ahmad', lastName: 'Fauzi', email: 'ahmad@tech.com', phone: '08123456791', gender: 'Male', position: posDev, dept: deptIT, employmentType: 'CONTRACT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP004', firstName: 'Dewi', lastName: 'Kusuma', email: 'dewi@tech.com', phone: '08123456792', gender: 'Female', position: posHR, dept: deptHR, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP005', firstName: 'Rudi', lastName: 'Hartono', email: 'rudi@tech.com', phone: '08123456793', gender: 'Male', position: posAcc, dept: deptFinance, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP006', firstName: 'Maya', lastName: 'Anggraini', email: 'maya@tech.com', phone: '08123456794', gender: 'Female', position: posMkt, dept: deptMarketing, employmentType: 'PERMANENT', employmentStatus: 'ACTIVE' },
    { employeeNumber: 'EMP007', firstName: 'Agus', lastName: 'Prasetyo', email: 'agus@tech.com', phone: '08123456795', gender: 'Male', position: posDev, dept: deptIT, employmentType: 'PROBATION', employmentStatus: 'PROBATION' },
    { employeeNumber: 'EMP008', firstName: 'Rina', lastName: 'Safitri', email: 'rina@tech.com', phone: '08123456796', gender: 'Female', position: posHR, dept: deptHR, employmentType: 'INTERN', employmentStatus: 'ACTIVE' },
  ];

  const createdEmployees: any[] = [];
  for (const emp of employees) {
    const created = await prisma.employee.upsert({
      where: { employeeNumber: emp.employeeNumber },
      update: {},
      create: {
        companyId: company.id, branchId: branch.id, departmentId: emp.dept.id, positionId: emp.position.id,
        employeeNumber: emp.employeeNumber, firstName: emp.firstName, lastName: emp.lastName,
        fullName: `${emp.firstName} ${emp.lastName}`, email: emp.email, phone: emp.phone,
        gender: emp.gender, joinDate: new Date('2024-01-15'),
        employmentType: emp.employmentType as any, employmentStatus: emp.employmentStatus as any,
        bankName: 'BCA', bankAccount: `123456${Math.floor(1000 + Math.random() * 9000)}`,
        bankAccountHolder: `${emp.firstName} ${emp.lastName}`,
      },
    });
    createdEmployees.push(created);

    // Create user accounts for employees
    if (emp.email) {
      const existingUser = await prisma.user.findUnique({ where: { email: emp.email } });
      if (!existingUser) {
        const user = await prisma.user.create({
          data: { email: emp.email, passwordHash, status: 'ACTIVE', mustChangePassword: false, employeeId: created.id },
        });
        const employeeRole = await prisma.role.findUnique({ where: { code: 'EMPLOYEE' } });
        if (employeeRole) {
          await prisma.userRole.create({ data: { userId: user.id, roleId: employeeRole.id, scopeType: 'COMPANY' } });
        }
      }
    }
  }
  console.log(`  ✓ ${createdEmployees.length} employees created`);

  // ===================================================
  // 5. SALARY COMPONENTS
  // ===================================================
  console.log('  Creating salary components...');
  const salaryComponents = [
    { name: 'Gaji Pokok', code: 'GP', type: 'ALLOWANCE', calcMethod: 'FIXED', isTaxable: true },
    { name: 'Tunjangan Makan', code: 'TM', type: 'ALLOWANCE', calcMethod: 'FIXED', amount: 1500000, isTaxable: false },
    { name: 'Tunjangan Transport', code: 'TT', type: 'ALLOWANCE', calcMethod: 'FIXED', amount: 1000000, isTaxable: false },
    { name: 'Tunjangan Jabatan', code: 'TJ', type: 'ALLOWANCE', calcMethod: 'PERCENTAGE', rate: 10, isTaxable: true },
    { name: 'BPJS Kesehatan', code: 'BPJS-KES', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 1, isTaxable: false },
    { name: 'BPJS Ketenagakerjaan', code: 'BPJS-TK', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 2, isTaxable: false },
    { name: 'PPh 21', code: 'PPH21', type: 'DEDUCTION', calcMethod: 'PERCENTAGE', rate: 5, isTaxable: false },
  ];

  const createdComponents: any[] = [];
  for (const sc of salaryComponents) {
    const created = await prisma.salaryComponent.upsert({
      where: { code: sc.code },
      update: {},
      create: {
        companyId: company.id, name: sc.name, code: sc.code,
        type: sc.type as any, calculationMethod: sc.calcMethod,
        amount: (sc as any).amount, ratePercent: (sc as any).rate,
        isTaxable: sc.isTaxable, isActive: true, sortOrder: salaryComponents.indexOf(sc),
      },
    });
    createdComponents.push(created);
  }
  console.log(`  ✓ ${createdComponents.length} salary components created`);

  // ===================================================
  // 6. EMPLOYEE SALARIES
  // ===================================================
  console.log('  Creating employee salaries...');
  for (const emp of createdEmployees) {
    const baseSalary = emp.employeeNumber === 'EMP001' ? 25000000 :
      emp.employmentType === 'INTERN' ? 5000000 :
      emp.employmentType === 'PROBATION' ? 8000000 : 12000000;

    const salary = await prisma.employeeSalary.upsert({
      where: { id: `sal-${emp.id}` },
      update: {},
      create: {
        id: `sal-${emp.id}`, employeeId: emp.id, companyId: company.id,
        effectiveDate: new Date('2024-01-01'), baseSalary, isActive: true,
      },
    });

    // Assign components
    for (const comp of createdComponents) {
      let amount = 0;
      if (comp.calculationMethod === 'FIXED') amount = Number(comp.amount) || 0;
      else if (comp.calculationMethod === 'PERCENTAGE') amount = baseSalary * (Number(comp.ratePercent) / 100);

      if (amount > 0) {
        await prisma.employeeSalaryComponent.upsert({
          where: { employeeSalaryId_salaryComponentId: { employeeSalaryId: salary.id, salaryComponentId: comp.id } },
          update: { amount },
          create: { employeeSalaryId: salary.id, salaryComponentId: comp.id, amount },
        });
      }
    }
  }
  console.log(`  ✓ Salaries created for ${createdEmployees.length} employees`);

  // ===================================================
  // 7. LEAVE TYPES
  // ===================================================
  console.log('  Creating leave types...');
  const leaveTypes = [
    { name: 'Annual Leave', code: 'ANNUAL', isPaid: true, isAnnual: true, maxDays: 12, requiresAttachment: false },
    { name: 'Sick Leave', code: 'SICK', isPaid: true, isAnnual: false, maxDays: 14, requiresAttachment: false },
    { name: 'Maternity Leave', code: 'MATERNITY', isPaid: true, isAnnual: false, maxDays: 90, requiresAttachment: true },
    { name: 'Paternity Leave', code: 'PATERNITY', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
    { name: 'Marriage Leave', code: 'MARRIAGE', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: true },
    { name: 'Bereavement Leave', code: 'BEREAVEMENT', isPaid: true, isAnnual: false, maxDays: 3, requiresAttachment: false },
    { name: 'Unpaid Leave', code: 'UNPAID', isPaid: false, isAnnual: false, maxDays: 30, requiresAttachment: false },
  ];

  const createdLeaveTypes: any[] = [];
  for (const lt of leaveTypes) {
    const created = await prisma.leaveType.upsert({
      where: { code: lt.code },
      update: {}, create: { ...lt, companyId: company.id, sortOrder: leaveTypes.indexOf(lt) },
    });
    createdLeaveTypes.push(created);
  }
  console.log(`  ✓ ${createdLeaveTypes.length} leave types created`);

  // ===================================================
  // 8. LEAVE BALANCES & REQUESTS
  // ===================================================
  console.log('  Creating leave balances...');
  for (const emp of createdEmployees) {
    for (const lt of createdLeaveTypes.filter((l) => l.isAnnual)) {
      await prisma.leaveBalance.upsert({
        where: { employeeId_leaveTypeId_year: { employeeId: emp.id, leaveTypeId: lt.id, year: 2026 } },
        update: {}, create: { employeeId: emp.id, companyId: company.id, leaveTypeId: lt.id, year: 2026, totalDays: lt.maxDays, usedDays: 0, remainingDays: lt.maxDays },
      });
    }
  }
  console.log(`  ✓ Leave balances created`);

  // Sample leave requests
  const annualLeave = createdLeaveTypes.find((l) => l.code === 'ANNUAL');
  const sickLeave = createdLeaveTypes.find((l) => l.code === 'SICK');
  if (annualLeave && sickLeave && createdEmployees.length >= 2) {
    await prisma.leaveRequest.create({
      data: {
        employeeId: createdEmployees[1].id, companyId: company.id, leaveTypeId: annualLeave.id,
        startDate: new Date('2026-07-10'), endDate: new Date('2026-07-12'), totalDays: 3,
        reason: 'Acara keluarga', status: 'PENDING',
      },
    });
    await prisma.leaveRequest.create({
      data: {
        employeeId: createdEmployees[2].id, companyId: company.id, leaveTypeId: sickLeave.id,
        startDate: new Date('2026-06-20'), endDate: new Date('2026-06-21'), totalDays: 2,
        reason: 'Kurang enak badan', status: 'APPROVED', approvedAt: new Date(),
      },
    });
  }

  // ===================================================
  // 9. BENEFIT PLANS
  // ===================================================
  console.log('  Creating benefit plans...');
  const benefitPlans = [
    { name: 'BPJS Kesehatan', code: 'BPJS-KES', type: 'BPJS', provider: 'BPJS', employeeContribution: 1, employerContribution: 4 },
    { name: 'BPJS Ketenagakerjaan', code: 'BPJS-TK', type: 'BPJS', provider: 'BPJS', employeeContribution: 2, employerContribution: 4.24 },
    { name: 'Private Health Insurance', code: 'PRIV-INS', type: 'INSURANCE', provider: 'AXA Mandiri', employeeContribution: 0, employerContribution: 100 },
    { name: 'THR', code: 'THR', type: 'ALLOWANCE', provider: 'Company', employeeContribution: 0, employerContribution: 100 },
  ];

  for (const bp of benefitPlans) {
    await prisma.benefitPlan.upsert({
      where: { code: bp.code }, update: {}, create: { ...bp, companyId: company.id, isActive: true },
    });
  }
  console.log(`  ✓ ${benefitPlans.length} benefit plans created`);

  // ===================================================
  // 10. TRAINING CATEGORIES & COURSES
  // ===================================================
  console.log('  Creating training data...');
  const trainingCat = await prisma.trainingCategory.upsert({
    where: { code: 'TECH' }, update: {}, create: { companyId: company.id, name: 'Technical Skills', code: 'TECH' },
  });
  const trainingCat2 = await prisma.trainingCategory.upsert({
    where: { code: 'SOFT' }, update: {}, create: { companyId: company.id, name: 'Soft Skills', code: 'SOFT' },
  });

  const courses = [
    { title: 'Advanced TypeScript', code: 'TS-101', categoryId: trainingCat.id, duration: 16, durationUnit: 'hours', provider: 'Internal', isMandatory: false },
    { title: 'React Enterprise', code: 'REACT-201', categoryId: trainingCat.id, duration: 24, durationUnit: 'hours', provider: 'Online Course', isMandatory: false },
    { title: 'Leadership Training', code: 'LEAD-101', categoryId: trainingCat2.id, duration: 2, durationUnit: 'days', provider: 'External Consultant', isMandatory: true },
    { title: 'Safety Induction', code: 'SAFE-001', categoryId: trainingCat2.id, duration: 4, durationUnit: 'hours', provider: 'Company', isMandatory: true },
  ];

  for (const course of courses) {
    await prisma.trainingCourse.upsert({
      where: { code: course.code }, update: {}, create: { ...course, companyId: company.id },
    });
  }
  console.log(`  ✓ ${courses.length} courses created`);

  // ===================================================
  // 11. PAYROLL PERIOD
  // ===================================================
  console.log('  Creating payroll period...');
  await prisma.payrollPeriod.upsert({
    where: { code: 'P202606' },
    update: {},
    create: {
      companyId: company.id, name: 'June 2026', code: 'P202606', frequency: 'MONTHLY',
      startDate: new Date('2026-06-01'), endDate: new Date('2026-06-30'), payDate: new Date('2026-07-05'), status: 'ACTIVE',
    },
  });

  // ===================================================
  // 12. PERFORMANCE REVIEW CYCLE
  // ===================================================
  console.log('  Creating performance review...');
  const cycle = await prisma.reviewCycle.upsert({
    where: { code: 'Q2-2026' }, update: {},
    create: {
      companyId: company.id, name: 'Q2 2026 Performance Review', code: 'Q2-2026',
      type: 'QUARTERLY', startDate: new Date('2026-04-01'), endDate: new Date('2026-06-30'),
      reviewDeadline: new Date('2026-07-15'), status: 'ACTIVE',
    },
  });

  // Create a sample review
  if (createdEmployees.length >= 2) {
    await prisma.performanceReview.upsert({
      where: { id: `rev-${createdEmployees[1].id}` },
      update: {}, create: {
        id: `rev-${createdEmployees[1].id}`, cycleId: cycle.id, employeeId: createdEmployees[1].id,
        companyId: company.id, title: `Q2 Review - ${createdEmployees[1].fullName}`,
        type: 'MANAGER', status: 'DRAFT',
      },
    });
  }

  // ===================================================
  // 13. GOALS
  // ===================================================
  console.log('  Creating goals...');
  const goals = [
    { employeeId: createdEmployees[1]?.id, title: 'Complete API Migration', type: 'PERSONAL', priority: 'HIGH', progress: 75 },
    { employeeId: createdEmployees[1]?.id, title: 'Reduce Bug Count by 30%', type: 'PERSONAL', priority: 'CRITICAL', progress: 50 },
    { employeeId: createdEmployees[3]?.id, title: 'Interview 20 Candidates', type: 'PERSONAL', priority: 'HIGH', progress: 60 },
    { employeeId: createdEmployees[3]?.id, title: 'Update Employee Handbook', type: 'PERSONAL', priority: 'MEDIUM', progress: 100 },
  ];

  for (const goal of goals) {
    if (!goal.employeeId) continue;
    await prisma.goal.create({
      data: {
        employeeId: goal.employeeId, companyId: company.id, title: goal.title,
        type: goal.type as any, startDate: new Date('2026-01-01'), endDate: new Date('2026-12-31'),
        progress: goal.progress, status: 'IN_PROGRESS', priority: goal.priority as any,
      },
    });
  }
  console.log(`  ✓ ${goals.length} goals created`);

  // ===================================================
  // 14. RECRUITMENT
  // ===================================================
  console.log('  Creating recruitment data...');
  const jobPosting = await prisma.jobPosting.upsert({
    where: { code: 'SR-DEV-2026' },
    update: {},
    create: {
      companyId: company.id, departmentId: deptIT.id, positionId: posDev.id,
      title: 'Senior Software Developer', code: 'SR-DEV-2026',
      employmentType: 'FULL_TIME', location: 'Jakarta',
      minSalary: 25000000, maxSalary: 40000000,
      description: 'Kami mencari Senior Software Developer berpengalaman untuk bergabung dengan tim engineering kami.',
      requirements: '- Minimal 5 tahun pengalaman\n- Menguasai TypeScript, Node.js, React\n- Pengalaman dengan microservices\n- SQL & NoSQL databases',
      vacancies: 2, status: 'PUBLISHED', postedAt: new Date(),
    },
  });

  const candidate = await prisma.candidate.upsert({
    where: { id: 'cand-001' },
    update: {},
    create: {
      id: 'cand-001', companyId: company.id, firstName: 'Farhan', lastName: 'Kurniawan',
      email: 'farhan@email.com', phone: '08111111111', currentCompany: 'PT Digital Solusi',
      currentPosition: 'Software Engineer', source: 'LinkedIn', status: 'ACTIVE',
    },
  });

  await prisma.jobApplication.upsert({
    where: { id: 'app-001' },
    update: {}, create: {
      id: 'app-001', jobPostingId: jobPosting.id, candidateId: candidate.id, companyId: company.id,
      status: 'INTERVIEW', coverLetter: 'Saya tertarik bergabung...', expectedSalary: 30000000,
    },
  });

  // ===================================================
  // 15. ATTENDANCE RECORDS (last 7 days)
  // ===================================================
  console.log('  Creating attendance records...');
  const today = new Date();
  let attendanceCount = 0;

  for (const emp of createdEmployees) {
    for (let i = 1; i <= 7; i++) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      if (d.getDay() === 0 || d.getDay() === 6) continue; // Skip weekends

      const nineAM = new Date(d); nineAM.setHours(9, 0, 0, 0);
      const checkIn = new Date(nineAM);
      checkIn.setMinutes(checkIn.getMinutes() + (emp.employeeNumber === 'EMP002' ? 15 : 0)); // EMP002 always late
      const checkOut = new Date(d); checkOut.setHours(17, 0, 0, 0);
      const status = emp.employeeNumber === 'EMP002' ? 'LATE' : 'PRESENT';

      await prisma.attendance.upsert({
        where: { employeeId_date: { employeeId: emp.id, date: d } },
        update: {},
        create: {
          employeeId: emp.id, companyId: company.id, date: d, checkIn, checkOut,
          status: status as any, workDuration: 480,
          lateMinutes: status === 'LATE' ? 15 : 0,
        },
      });
      attendanceCount++;
    }
  }
  console.log(`  ✓ ${attendanceCount} attendance records created`);

  console.log('\n  ✓ Test data seeding completed!');
  console.log('  ─────────────────────────────────────────');
  console.log('  Login credentials:');
  console.log('  Super Admin: admin@hrms.com / Admin123!');
  console.log('  Employee:     bambang@tech.com / Employee123!');
  console.log('  Employee:     siti@tech.com / Employee123!');
}
