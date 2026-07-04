import api from './api';

// ─── Types ──────────────────────────────────────────────
export interface WorkDayRule {
  enabled: boolean;
  workStart?: string | null;
  workEnd?: string | null;
}

export type WorkDayKey = 'mon' | 'tue' | 'wed' | 'thu' | 'fri' | 'sat' | 'sun';

export interface WorkCalendar {
  id: string;
  companyId: string;
  branchId?: string | null;
  departmentId?: string | null;
  name: string;
  year: number;
  workDays: WorkDaysConfig;
  description?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { days: number };
}

export type WorkDaysConfig = Record<WorkDayKey, WorkDayRule>;

type RawWorkDaysConfig = Partial<Record<WorkDayKey, boolean | WorkDayRule>>;

export interface CalendarDay {
  id: string;
  calendarId: string;
  date: string;
  dayType: DayType;
  name?: string | null;
  notes?: string | null;
  workStart?: string | null;
  workEnd?: string | null;
  isMandatory?: boolean;
}

export type DayType = 'WD' | 'WS' | 'WE' | 'NH' | 'JL' | 'CH' | 'RH' | 'OT';

export interface Holiday {
  id: string;
  companyId: string;
  date: string;
  name: string;
  type: 'NH' | 'JL';
  year: number;
  source?: string | null;
}

export interface ShiftFormulaDay {
  id?: string;
  sequence: number;
  label?: string | null;
  dayType: DayType;
  workStart?: string | null;
  workEnd?: string | null;
  crossesMidnight?: boolean;
}

export interface ShiftFormula {
  id: string;
  companyId: string;
  code: string;
  name: string;
  cycleLength: number;
  description?: string | null;
  createdBy?: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
  days: ShiftFormulaDay[];
  _count?: { employees: number };
}

export interface MyWorkCalendarDay {
  date: string;
  dayType: DayType;
  workStart?: string | null;
  workEnd?: string | null;
  isWorkingDay: boolean;
  scheduleSource: 'CALENDAR' | 'SHIFT_FORMULA';
  shiftFormulaId?: string | null;
  shiftFormulaName?: string | null;
  shiftFormulaCode?: string | null;
  crossesMidnight?: boolean;
  label?: string | null;
  notes?: string | null;
  calendarId?: string | null;
  absence?: {
    source: 'LEAVE_REQUEST' | 'PERMISSION_REQUEST';
    category: 'CUTI' | 'IZIN' | 'SAKIT';
    requestId: string;
    label: string;
    reason: string;
    startDate: string;
    endDate: string;
    partialDay: boolean;
  } | null;
}

export interface MyWorkCalendarMonth {
  employee: {
    id: string;
    employeeNumber: string;
    fullName: string;
    employeeCategory: 'OFFICE' | 'FACTORY' | 'FIELD' | 'REMOTE';
    branch?: { id: string; name: string } | null;
    department?: { id: string; name: string } | null;
    position?: { id: string; name: string } | null;
  };
  linkedCalendar: {
    id: string;
    name: string;
    year: number;
    scope: 'COMPANY' | 'BRANCH' | 'DEPARTMENT';
  } | null;
  shiftFormula: {
    id: string;
    code: string;
    name: string;
    cycleLength: number;
    startDate: string | null;
  } | null;
  period: {
    year: number;
    month: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalDays: number;
    workingDays: number;
    offDays: number;
    calendarDays: number;
    shiftDays: number;
    approvedLeaveDays: number;
    approvedPermissionDays: number;
    approvedSickDays: number;
  };
  days: MyWorkCalendarDay[];
}

const WORK_DAY_KEYS: WorkDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];

function normalizeWorkDayRule(rule?: boolean | WorkDayRule): WorkDayRule {
  if (typeof rule === 'boolean') {
    return {
      enabled: rule,
      workStart: null,
      workEnd: null,
    };
  }

  return {
    enabled: Boolean(rule?.enabled),
    workStart: rule?.workStart ?? null,
    workEnd: rule?.workEnd ?? null,
  };
}

export function normalizeWorkDaysConfig(config?: RawWorkDaysConfig | null): WorkDaysConfig {
  const source = config || {};

  return WORK_DAY_KEYS.reduce((acc, day) => {
    acc[day] = normalizeWorkDayRule(source[day]);
    return acc;
  }, {} as WorkDaysConfig);
}

function normalizeCalendar(calendar: WorkCalendar) {
  return {
    ...calendar,
    workDays: normalizeWorkDaysConfig(calendar.workDays as unknown as RawWorkDaysConfig),
  };
}

// ─── Service ────────────────────────────────────────────
class WorkCalendarService {
  // ─── Calendars ───────────────────────────────────────
  async findAll(companyId: string) {
    const r = await api.get('/work-calendars', { params: { companyId } });
    return (r.data.data as WorkCalendar[]).map(normalizeCalendar);
  }

  async findById(id: string) {
    const r = await api.get(`/work-calendars/${id}`);
    return normalizeCalendar(r.data.data as WorkCalendar);
  }

  async create(data: Partial<WorkCalendar>) {
    const r = await api.post('/work-calendars', data);
    return normalizeCalendar(r.data.data as WorkCalendar);
  }

  async update(id: string, data: Partial<WorkCalendar>) {
    const r = await api.put(`/work-calendars/${id}`, data);
    return normalizeCalendar(r.data.data as WorkCalendar);
  }

  async delete(id: string) {
    const r = await api.delete(`/work-calendars/${id}`);
    return r.data;
  }

  // ─── Calendar Days ───────────────────────────────────
  async findDays(calendarId: string, year: number, month: number) {
    const r = await api.get(`/work-calendars/${calendarId}/days`, {
      params: { year, month },
    });
    return r.data.data as CalendarDay[];
  }

  async bulkUpdateDays(calendarId: string, days: { date: string; dayType: DayType; name?: string; notes?: string; workStart?: string | null; workEnd?: string | null; isMandatory?: boolean }[]) {
    const r = await api.put(`/work-calendars/${calendarId}/days`, { days });
    return r.data.data;
  }

  async generateDefaultDays(calendarId: string) {
    const r = await api.post(`/work-calendars/${calendarId}/generate`);
    return r.data.data;
  }

  // ─── Copy Calendar ───────────────────────────────────
  async copyCalendar(id: string, targetYear: number, name?: string) {
    const r = await api.post(`/work-calendars/${id}/copy`, { targetYear, name });
    return normalizeCalendar(r.data.data as WorkCalendar);
  }

  // ─── Working Days ────────────────────────────────────
  async countWorkingDays(calendarId: string, start: string, end: string) {
    const r = await api.get(`/work-calendars/${calendarId}/working-days`, {
      params: { calendarId, start, end },
    });
    return r.data.data as { count: number };
  }

  // ─── Holidays ────────────────────────────────────────
  async findAllHolidays(companyId: string, year?: number) {
    const r = await api.get('/work-calendars/holidays/list', {
      params: { companyId, year },
    });
    return r.data.data as Holiday[];
  }

  async createHoliday(data: Partial<Holiday>) {
    const r = await api.post('/work-calendars/holidays', data);
    return r.data.data as Holiday;
  }

  async updateHoliday(id: string, data: Partial<Holiday>) {
    const r = await api.put(`/work-calendars/holidays/${id}`, data);
    return r.data.data as Holiday;
  }

  async deleteHoliday(id: string) {
    const r = await api.delete(`/work-calendars/holidays/${id}`);
    return r.data;
  }

  // ─── Shift Formulas ───────────────────────────────────
  async findAllShiftFormulas(companyId: string) {
    const r = await api.get('/work-calendars/shift-formulas', { params: { companyId } });
    return r.data.data as ShiftFormula[];
  }

  async findShiftFormulaById(id: string) {
    const r = await api.get(`/work-calendars/shift-formulas/${id}`);
    return r.data.data as ShiftFormula;
  }

  async createShiftFormula(data: {
    companyId: string;
    code: string;
    name: string;
    description?: string;
    isActive?: boolean;
    days: ShiftFormulaDay[];
  }) {
    const r = await api.post('/work-calendars/shift-formulas', data);
    return r.data.data as ShiftFormula;
  }

  async updateShiftFormula(id: string, data: {
    code?: string;
    name?: string;
    description?: string;
    isActive?: boolean;
    days?: ShiftFormulaDay[];
  }) {
    const r = await api.put(`/work-calendars/shift-formulas/${id}`, data);
    return r.data.data as ShiftFormula;
  }

  async deleteShiftFormula(id: string) {
    const r = await api.delete(`/work-calendars/shift-formulas/${id}`);
    return r.data;
  }

  // ─── Employee & Team ─────────────────────────────────
  async getEmployeeCalendar(employeeId: string) {
    const r = await api.get(`/work-calendars/employee/${employeeId}`);
    return r.data.data as WorkCalendar;
  }

  async getTeamCalendar(managerId: string, companyId: string, year: number, month: number) {
    const r = await api.get(`/work-calendars/team/${managerId}`, {
      params: { companyId, year, month },
    });
    return r.data.data;
  }

  async getMyResolvedCalendar(year: number, month: number) {
    const r = await api.get('/work-calendars/me/resolved', {
      params: { year, month },
    });
    return r.data.data as MyWorkCalendarMonth;
  }
}

export const workCalendarService = new WorkCalendarService();
