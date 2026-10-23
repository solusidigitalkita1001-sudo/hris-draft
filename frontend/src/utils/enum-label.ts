import type { TranslationKey, TranslationParams } from '@/i18n/translations';

type Translate = (key: TranslationKey, params?: TranslationParams) => string;

/**
 * Kode enum dari database tidak layak tampil apa adanya ke pengguna:
 * "CONTRACT_END" dan "FEMALE" adalah bahasa mesin. Peta ini menerjemahkannya,
 * dengan fallback ke kode mentah supaya nilai baru dari server tetap terbaca
 * (jelek, tapi tidak hilang) sampai labelnya ditambahkan.
 */
const EMPLOYEE_STATUS: Record<string, TranslationKey> = {
  ACTIVE: 'wf.enum.employeeStatus.active',
  PROBATION: 'wf.enum.employeeStatus.probation',
  RESIGNED: 'wf.enum.employeeStatus.resigned',
  TERMINATED: 'wf.enum.employeeStatus.terminated',
  CONTRACT_END: 'wf.enum.employeeStatus.contractEnd',
  INACTIVE: 'wf.enum.employeeStatus.inactive',
};

const EMPLOYMENT_TYPE: Record<string, TranslationKey> = {
  PERMANENT: 'ops.profile.employmentType.permanent',
  CONTRACT: 'ops.profile.employmentType.contract',
  PROBATION: 'ops.profile.employmentType.probation',
  INTERNSHIP: 'ops.profile.employmentType.internship',
  INTERN: 'ops.profile.employmentType.internship',
  FREELANCE: 'ops.profile.employmentType.freelance',
  PART_TIME: 'ops.profile.employmentType.partTime',
};

const EMPLOYEE_CATEGORY: Record<string, TranslationKey> = {
  OFFICE: 'ops.profile.category.office',
  FACTORY: 'ops.profile.category.factory',
  FIELD: 'ops.profile.category.field',
  REMOTE: 'ops.profile.category.remote',
};

const GENDER: Record<string, TranslationKey> = {
  MALE: 'wf.common.gender.male',
  FEMALE: 'wf.common.gender.female',
};

const MARITAL_STATUS: Record<string, TranslationKey> = {
  SINGLE: 'wf.common.marital.single',
  MARRIED: 'wf.common.marital.married',
  DIVORCED: 'wf.common.marital.divorced',
  WIDOWED: 'wf.common.marital.widowed',
};

const ATTENDANCE_METHOD: Record<string, TranslationKey> = {
  MANUAL: 'wf.enum.attendanceMethod.manual',
  WEB: 'wf.enum.attendanceMethod.web',
  MOBILE: 'wf.enum.attendanceMethod.mobile',
  FACE: 'wf.enum.attendanceMethod.face',
  FACE_RECOGNITION: 'wf.enum.attendanceMethod.face',
  FINGERPRINT: 'wf.enum.attendanceMethod.fingerprint',
  GPS: 'wf.enum.attendanceMethod.gps',
  QR: 'wf.enum.attendanceMethod.qr',
  QR_CODE: 'wf.enum.attendanceMethod.qr',
};

function label(map: Record<string, TranslationKey>, code: string | null | undefined, t: Translate): string {
  if (!code) return '-';
  const key = map[code.toUpperCase()];
  return key ? t(key) : code;
}

export const employeeStatusLabel = (code: string | null | undefined, t: Translate) => label(EMPLOYEE_STATUS, code, t);
export const employmentTypeLabel = (code: string | null | undefined, t: Translate) => label(EMPLOYMENT_TYPE, code, t);
export const employeeCategoryLabel = (code: string | null | undefined, t: Translate) => label(EMPLOYEE_CATEGORY, code, t);
export const genderLabel = (code: string | null | undefined, t: Translate) => label(GENDER, code, t);
export const maritalStatusLabel = (code: string | null | undefined, t: Translate) => label(MARITAL_STATUS, code, t);
export const attendanceMethodLabel = (code: string | null | undefined, t: Translate) => label(ATTENDANCE_METHOD, code, t);
