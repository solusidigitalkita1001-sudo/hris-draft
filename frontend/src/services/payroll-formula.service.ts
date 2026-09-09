import api from './api';
export interface PayrollFormulaVersion {
  id: string; componentId: string; version: number; expression: string; effectiveFrom: string;
  status: 'DRAFT' | 'PUBLISHED'; createdBy: string; previewedAt: string | null;
  publishedBy: string | null; publishedAt: string | null; engineVersion: number;
}
export type FormulaInputs = Record<'BASE_SALARY' | 'WORK_DAYS' | 'PRESENT_DAYS' | 'LEAVE_DAYS' | 'ABSENT_DAYS' | 'OVERTIME_HOURS', string>;
export interface FormulaPreview { versionId: string; amount: string; effectiveFrom: string; rounding: string; engineVersion: number; components: Record<string, string> }
const path = (componentId: string) => `/payroll/formulas/${componentId}/versions`;
type Envelope<T> = { data: T };
export const payrollFormulaService = {
  async list(componentId: string, signal?: AbortSignal) {
    return (await api.get<Envelope<PayrollFormulaVersion[]>>(path(componentId), { signal })).data.data;
  },
  async create(componentId: string, data: { expression: string; effectiveFrom: string }) {
    return (await api.post<Envelope<PayrollFormulaVersion>>(path(componentId), data)).data.data;
  },
  async preview(componentId: string, versionId: string, inputs: FormulaInputs, componentAmounts: Record<string, string>) {
    return (await api.post<Envelope<FormulaPreview>>(`${path(componentId)}/${versionId}/preview`, { inputs, componentAmounts })).data.data;
  },
  async publish(componentId: string, versionId: string) {
    return (await api.post<Envelope<PayrollFormulaVersion>>(`${path(componentId)}/${versionId}/publish`, {})).data.data;
  },
};
