import { createHash } from 'node:crypto';
import { Prisma, PrismaClient, PayrollFormulaVersion, SalaryComponent } from '@prisma/client';
import { prisma } from '@/shared/database/prisma';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '@/shared/exceptions/AppError';
import { compileFormula, FORMULA_ENGINE_VERSION, resolvePayrollComponents, selectFormulaVersions,
  SYSTEM_PAYROLL_CODES, validateFormulaGraph } from '@/shared/payroll/formula';
import { formulaDraftSchema, formulaPreviewSchema, FormulaDraftDTO, FormulaPreviewDTO } from './payroll-formula.dto';

export interface FormulaContext { companyId: string; actorId: string; ipAddress?: string; requestId?: string }
function contextRequired(context: FormulaContext) {
  if (!context.companyId || !context.actorId) throw new ForbiddenError('Validated company and actor are required');
}
const view = (version: PayrollFormulaVersion) => ({ ...version, effectiveFrom: version.effectiveFrom.toISOString().slice(0, 10) });
function validateVersionGraph(components: SalaryComponent[], versions: PayrollFormulaVersion[], candidate: PayrollFormulaVersion) {
  const available = new Set(components.map(component => component.code));
  const withCandidate = [...versions.filter(version => version.id !== candidate.id), candidate];
  // Check every subsequent schedule boundary, including future published revisions.
  const boundaries = new Set([candidate.effectiveFrom.getTime(), ...versions.filter(version =>
    version.effectiveFrom >= candidate.effectiveFrom).map(version => version.effectiveFrom.getTime())]);
  for (const timestamp of boundaries) {
    const selected = selectFormulaVersions(withCandidate, new Date(timestamp));
    validateFormulaGraph(new Map(components.flatMap(component => {
      const version = selected.get(component.id);
      return version ? [[component.code, version.expression] as const] : [];
    })), available);
  }
}

export class PayrollFormulaService {
  constructor(private readonly database: PrismaClient = prisma) {}
  private async write<T>(context: FormulaContext, work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    contextRequired(context);
    for (let attempt = 0; ; attempt++) {
      try {
        return await this.database.$transaction(async tx => {
          // Lock the company row until COMMIT, serializing revisions and graph publication.
          const company = await tx.$queryRaw<{ id: string }[]>`SELECT id FROM companies WHERE id = ${context.companyId} AND deleted_at IS NULL FOR UPDATE`;
          if (!company.length) throw new NotFoundError('Company not found');
          return work(tx);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
      } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034' && attempt < 2) continue;
        throw error;
      }
    }
  }
  private async component(tx: Prisma.TransactionClient, context: FormulaContext, id: string) {
    const component = await tx.salaryComponent.findFirst({ where: { id, companyId: context.companyId, deletedAt: null } });
    if (!component) throw new NotFoundError('Salary component not found');
    if (SYSTEM_PAYROLL_CODES.has(component.code)) throw new BadRequestError('System payroll components use their dedicated calculation engines');
    return component;
  }
  private async revision(tx: Prisma.TransactionClient, context: FormulaContext, componentId: string, versionId: string) {
    await this.component(tx, context, componentId);
    const version = await tx.payrollFormulaVersion.findFirst({ where: { id: versionId, componentId, companyId: context.companyId } });
    if (!version) throw new NotFoundError('Formula version not found');
    return version;
  }
  private async audit(tx: Prisma.TransactionClient, context: FormulaContext, version: PayrollFormulaVersion, action: string) {
    await tx.payrollFormulaAudit.create({ data: { companyId: context.companyId, versionId: version.id,
      actorId: context.actorId, action, expressionHash: version.expressionHash,
      ipAddress: context.ipAddress?.slice(0, 45), requestId: context.requestId?.slice(0, 100) } });
  }
  async list(context: FormulaContext, componentId: string) {
    contextRequired(context); await this.component(this.database, context, componentId);
    return (await this.database.payrollFormulaVersion.findMany({ where: { companyId: context.companyId, componentId }, orderBy: { version: 'desc' } })).map(view);
  }
  async createDraft(context: FormulaContext, componentId: string, input: FormulaDraftDTO) {
    const parsed = formulaDraftSchema.parse(input); const compiled = compileFormula(parsed.expression);
    return this.write(context, async tx => {
      const component = await this.component(tx, context, componentId);
      if (!component.isActive) throw new BadRequestError('Activate the salary component before creating a formula');
      const available = await tx.salaryComponent.findMany({ where: { companyId: context.companyId, isActive: true, deletedAt: null } });
      for (const code of compiled.references) if (!available.some(item => item.code === code)) throw new BadRequestError(`Formula reference ${code} is unavailable in this company`);
      if (compiled.references.includes(component.code)) throw new BadRequestError('Formula cannot reference its own component');
      const latest = await tx.payrollFormulaVersion.findFirst({ where: { componentId, companyId: context.companyId }, orderBy: { version: 'desc' } });
      const created = await tx.payrollFormulaVersion.create({ data: { companyId: context.companyId, componentId,
        version: (latest?.version ?? 0) + 1, expression: parsed.expression, effectiveFrom: new Date(`${parsed.effectiveFrom}T00:00:00.000Z`),
        expressionHash: createHash('sha256').update(parsed.expression).digest('hex'), engineVersion: FORMULA_ENGINE_VERSION, createdBy: context.actorId } });
      await this.audit(tx, context, created, 'DRAFT_CREATED');
      return view(created);
    });
  }
  async preview(context: FormulaContext, componentId: string, versionId: string, input: FormulaPreviewDTO) {
    const parsed = formulaPreviewSchema.parse(input);
    return this.write(context, async tx => {
      const candidate = await this.revision(tx, context, componentId, versionId);
      const components = await tx.salaryComponent.findMany({ where: { companyId: context.companyId, isActive: true, deletedAt: null } });
      const versions = await tx.payrollFormulaVersion.findMany({ where: { companyId: context.companyId, status: 'PUBLISHED' } });
      validateVersionGraph(components, versions, candidate);
      const selected = selectFormulaVersions([...versions.filter(version => version.componentId !== componentId || version.effectiveFrom < candidate.effectiveFrom), candidate], candidate.effectiveFrom);
      const target = components.find(component => component.id === componentId);
      if (!target) throw new BadRequestError('Component is inactive');
      for (const code of Object.keys(parsed.componentAmounts)) if (!components.some(component => component.code === code)) throw new BadRequestError('Simulation contains an unavailable component');
      const required = new Set<string>();
      const collect = (code: string) => {
        if (required.has(code)) return; required.add(code);
        const component = components.find(item => item.code === code);
        if (!component) throw new BadRequestError(`Component ${code} is unavailable`);
        const version = selected.get(component.id);
        if (version) for (const reference of compileFormula(version.expression).references) collect(reference);
      };
      collect(target.code);
      const resolved = resolvePayrollComponents(components.filter(component => required.has(component.code)).map(component => {
        const amount = parsed.componentAmounts[component.code] ?? component.amount?.toString();
        if (!selected.has(component.id) && component.calculationMethod === 'FIXED' && amount === undefined) throw new BadRequestError(`Provide a simulation amount for ${component.code}`);
        return { id: component.id, code: component.code, method: component.calculationMethod,
          amount: amount ?? '0', ratePercent: component.ratePercent };
      }), parsed.inputs, selected);
      if (candidate.status === 'DRAFT') await tx.payrollFormulaVersion.updateMany({ where: { id: versionId, companyId: context.companyId, status: 'DRAFT' }, data: { previewedAt: new Date() } });
      await this.audit(tx, context, candidate, 'PREVIEW_SUCCEEDED');
      return { versionId, amount: resolved.amounts.get(target.code)!.toFixed(2), effectiveFrom: candidate.effectiveFrom.toISOString().slice(0, 10),
        rounding: 'HALF_UP_2_DECIMALS', engineVersion: FORMULA_ENGINE_VERSION,
        components: Object.fromEntries([...resolved.amounts].map(([code, amount]) => [code, amount.toFixed(2)])) };
    });
  }
  async publish(context: FormulaContext, componentId: string, versionId: string) {
    return this.write(context, async tx => {
      const candidate = await this.revision(tx, context, componentId, versionId);
      if (candidate.createdBy === context.actorId) throw new ForbiddenError('Formula must be published by a different user from its creator');
      if (candidate.status === 'PUBLISHED') return view(candidate);
      if (!candidate.previewedAt) throw new ConflictError('Run a successful simulation before publishing this revision');
      const components = await tx.salaryComponent.findMany({ where: { companyId: context.companyId, isActive: true, deletedAt: null } });
      if (!components.some(component => component.id === componentId)) throw new ConflictError('Formula component is inactive');
      const versions = await tx.payrollFormulaVersion.findMany({ where: { companyId: context.companyId, status: 'PUBLISHED' } });
      if (versions.some(version => version.componentId === componentId && version.effectiveFrom >= candidate.effectiveFrom)) {
        throw new ConflictError('Use an effective date after the latest published formula for this component');
      }
      const existingRun = await tx.payrollRun.findFirst({ where: { companyId: context.companyId, deletedAt: null,
        period: { startDate: { gte: candidate.effectiveFrom } } }, select: { id: true } });
      if (existingRun) throw new ConflictError('Effective date overlaps an existing payroll run; publish for a future period');
      validateVersionGraph(components, versions, candidate);
      const published = await tx.payrollFormulaVersion.update({ where: { id: versionId, companyId: context.companyId },
        data: { status: 'PUBLISHED', publishedBy: context.actorId, publishedAt: new Date() } });
      await this.audit(tx, context, published, 'PUBLISHED'); return view(published);
    });
  }
}
export const payrollFormulaService = new PayrollFormulaService();
