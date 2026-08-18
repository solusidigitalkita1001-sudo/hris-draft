export type SurveyStatus = 'DRAFT' | 'OPEN' | 'CLOSED' | 'ARCHIVED';
export type SurveyType = 'POLL' | 'SURVEY';
export type SurveyQuestionType = 'SINGLE_CHOICE' | 'MULTIPLE_CHOICE' | 'TEXT' | 'RATING_1_5';

export interface SurveyRow {
  id?: string | null;
  companyId?: string | null;
  type?: SurveyType | string;
  status?: SurveyStatus | string;
  anonymous?: boolean | null;
  allowMultipleSubmission?: boolean | null;
  startDate?: Date | string | null;
  endDate?: Date | string | null;
  targetAudienceIds?: string | null | string[];
  maxResponses?: number | null;
  totalResponses?: number | null;
  createdAt?: Date | string | null;
}

export interface SurveyQuestionRow {
  id: string;
  position?: number | null;
  questionText: string;
  type: SurveyQuestionType | string;
  optionsJson?: string | null | Array<{ value: string; label?: string }> | string[];
  required?: boolean | null;
  minSelect?: number | null;
  maxSelect?: number | null;
}

export interface SurveyAnswerRow {
  questionId: string;
  textValue?: string | null;
  numberValue?: number | string | Decimal | null;
  selectedJson?: string | null | string[];
}

type Decimal = { toNumber(): number } | number;

export interface SurveySubmissionContext {
  companyId: string | null;
  employeeId?: string | null;
  userId?: string | null;
  currentDate?: Date | string | number;
  hasRespondedBefore?: boolean;
}

function toDate(v: unknown): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d;
}

function toNum(v: unknown): number | null {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'object' && v !== null && typeof (v as any).toNumber === 'function') {
    const n = (v as any).toNumber();
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
  }
  if (typeof v === 'string') {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseStrArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.filter(x => typeof x === 'string').map(x => x as string);
  if (typeof v !== 'string' || v.length === 0) return [];
  try {
    const p = JSON.parse(v);
    if (Array.isArray(p)) return p.filter(x => typeof x === 'string').map(x => x as string);
  } catch {
    return v.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

function parseOptionsToValues(q: SurveyQuestionRow): string[] {
  if (Array.isArray(q.optionsJson)) {
    if (q.optionsJson.length === 0) return [];
    const first = q.optionsJson[0];
    if (typeof first === 'string') return q.optionsJson as string[];
    return (q.optionsJson as Array<{ value: string }>).map(o => o.value).filter(Boolean);
  }
  if (typeof q.optionsJson !== 'string' || q.optionsJson.length === 0) return [];
  try {
    const p = JSON.parse(q.optionsJson);
    if (Array.isArray(p)) {
      if (p.length === 0) return [];
      if (typeof p[0] === 'string') return p as string[];
      return (p as Array<{ value: string }>).map(o => o.value).filter(Boolean);
    }
  } catch {
    return q.optionsJson.split(',').map(s => s.trim()).filter(Boolean);
  }
  return [];
}

export interface SurveyEligibilityResult {
  eligible: boolean;
  reason: string | null;
}

export function isSurveyEligible(
  survey: SurveyRow,
  ctx: SurveySubmissionContext,
): SurveyEligibilityResult {
  const status = String(survey.status ?? '').toUpperCase() as SurveyStatus;
  if (status !== 'OPEN') return { eligible: false, reason: `Survey status=${status} bukan OPEN, belum bisa diisi.` };
  if (survey.companyId && ctx.companyId && String(survey.companyId) !== String(ctx.companyId)) {
    return { eligible: false, reason: 'Survey tidak tersedia untuk company Anda.' };
  }
  const now = ctx.currentDate ? (toDate(ctx.currentDate) ?? new Date()) : new Date();
  const s = toDate(survey.startDate);
  const e = toDate(survey.endDate);
  // Date compare only (ignore time window)
  const floorDay = (d: Date): Date => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = floorDay(now);
  if (s && today.getTime() < floorDay(s).getTime()) {
    return { eligible: false, reason: `Survey mulai tanggal ${s.toISOString().slice(0, 10)}, belum dibuka hari ini.` };
  }
  if (e && today.getTime() > floorDay(e).getTime()) {
    return { eligible: false, reason: `Survey ditutup tanggal ${e.toISOString().slice(0, 10)}, sudah melewati batas.` };
  }
  const targets = parseStrArray(survey.targetAudienceIds);
  if (targets.length > 0 && ctx.employeeId && !targets.includes(String(ctx.employeeId))) {
    return { eligible: false, reason: 'Anda tidak termasuk dalam daftar responden survey ini.' };
  }
  const max = toNum(survey.maxResponses);
  const total = toNum(survey.totalResponses) ?? 0;
  if (max !== null && total >= max) {
    return { eligible: false, reason: `Kuota response survey sudah penuh (max=${max}).` };
  }
  if (!survey.allowMultipleSubmission && ctx.hasRespondedBefore) {
    return { eligible: false, reason: 'Anda sudah pernah mengisi survey ini (hanya boleh 1x submit).' };
  }
  return { eligible: true, reason: null };
}

export interface ChoiceOptionStat {
  value: string;
  label: string;
  count: number;
  percent: number;
}

export interface RatingStats {
  average: number;
  count: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
}

export interface QuestionAggregate {
  questionId: string;
  questionType: SurveyQuestionType;
  totalResponses: number;
  skipped: number;
  // SINGLE_CHOICE + MULTIPLE_CHOICE
  options?: ChoiceOptionStat[];
  // TEXT
  textAnswers?: string[];
  // RATING_1_5
  rating?: RatingStats;
}

export interface SurveyAggregateResult {
  totalSubmissions: number;
  byQuestion: Record<string, QuestionAggregate>;
  orderedQuestionIds: string[];
}

function initChoiceStats(q: SurveyQuestionRow): ChoiceOptionStat[] {
  const vals = parseOptionsToValues(q);
  return vals.map(v => ({ value: v, label: v, count: 0, percent: 0 }));
}

function updateChoicePercents(arr: ChoiceOptionStat[], denominator: number, isMultiMode = false): void {
  if (!arr.length) return;
  const denom = isMultiMode
    ? arr.reduce((s, c) => s + c.count, 0)
    : denominator;
  for (const c of arr) {
    c.percent = denom > 0 ? Math.round((c.count / denom) * 10000) / 100 : 0;
  }
}

export function calculateSurveyAggregates(
  orderedQuestions: SurveyQuestionRow[],
  answerRowsPerSubmission: Array<SurveyAnswerRow[]>,
): SurveyAggregateResult {
  const orderedIds = orderedQuestions.map(q => q.id);
  const questionsById: Record<string, SurveyQuestionRow> = {};
  const byQuestion: Record<string, QuestionAggregate> = {};
  for (const q of orderedQuestions) {
    questionsById[q.id] = q;
    const type = String(q.type).toUpperCase() as SurveyQuestionType;
    const base: QuestionAggregate = {
      questionId: q.id,
      questionType: type,
      totalResponses: 0,
      skipped: 0,
    };
    if (type === 'SINGLE_CHOICE' || type === 'MULTIPLE_CHOICE') base.options = initChoiceStats(q);
    if (type === 'TEXT') base.textAnswers = [];
    if (type === 'RATING_1_5') base.rating = { average: 0, count: 0, distribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 } };
    byQuestion[q.id] = base;
  }

  const totalSubmissions = answerRowsPerSubmission.length;

  for (let submission = 0; submission < totalSubmissions; submission++) {
    const answers = answerRowsPerSubmission[submission] ?? [];
    const byAnswer: Record<string, SurveyAnswerRow> = {};
    for (const a of answers) byAnswer[a.questionId] = a;
    for (const q of orderedQuestions) {
      const agg = byQuestion[q.id];
      const ans = byAnswer[q.id];
      const answered = !!ans && (
        !!ans.textValue ||
        ans.numberValue !== null && ans.numberValue !== undefined && ans.numberValue !== '' ||
        (Array.isArray(ans.selectedJson) && ans.selectedJson.length > 0) ||
        (typeof ans.selectedJson === 'string' && ans.selectedJson.length > 0)
      );
      if (!answered) {
        agg.skipped += 1;
        continue;
      }
      agg.totalResponses += 1;
      switch (agg.questionType) {
        case 'SINGLE_CHOICE': {
          const val = ans?.textValue ?? (Array.isArray(ans?.selectedJson) ? ans!.selectedJson[0] : null);
          if (val && agg.options) {
            const hit = agg.options.find(o => o.value === val);
            if (hit) hit.count += 1;
          }
          break;
        }
        case 'MULTIPLE_CHOICE': {
          const arr = parseStrArray(ans?.selectedJson ?? ans?.textValue ?? []);
          for (const v of arr) {
            const hit = agg.options?.find(o => o.value === v);
            if (hit) hit.count += 1;
          }
          break;
        }
        case 'TEXT': {
          if (ans?.textValue && agg.textAnswers) agg.textAnswers.push(String(ans.textValue));
          break;
        }
        case 'RATING_1_5': {
          const n = toNum(ans?.numberValue ?? ans?.textValue);
          if (n !== null && Number.isInteger(n) && n >= 1 && n <= 5 && agg.rating) {
            agg.rating.distribution[n as 1 | 2 | 3 | 4 | 5] += 1;
            agg.rating.count += 1;
          }
          break;
        }
      }
    }
  }

  for (const q of orderedQuestions) {
    const agg = byQuestion[q.id];
    if ((agg.questionType === 'SINGLE_CHOICE' || agg.questionType === 'MULTIPLE_CHOICE') && agg.options) {
      updateChoicePercents(agg.options, agg.totalResponses, agg.questionType === 'MULTIPLE_CHOICE');
    }
    if (agg.questionType === 'RATING_1_5' && agg.rating && agg.rating.count > 0) {
      let sum = 0;
      for (let star = 1; star <= 5; star++) {
        sum += (agg.rating.distribution[star as 1 | 2 | 3 | 4 | 5] ?? 0) * star;
      }
      agg.rating.average = Math.round((sum / agg.rating.count) * 100) / 100;
    }
  }

  return { totalSubmissions, byQuestion, orderedQuestionIds: orderedIds };
}
