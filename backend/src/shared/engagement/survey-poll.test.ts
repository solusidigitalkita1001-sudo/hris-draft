import {
  isSurveyEligible,
  calculateSurveyAggregates,
  type SurveyQuestionRow,
} from './survey-poll';

const COMPANY_X = 'COMP-X';
const EMPLOYEE_BOB = 'EMP-BOB';

const qSingle: SurveyQuestionRow = {
  id: 'Q1', position: 1, questionText: 'Apakah Anda puas?',
  type: 'SINGLE_CHOICE',
  optionsJson: [
    { value: 'A', label: 'Sangat Puas' },
    { value: 'B', label: 'Cukup Puas' },
    { value: 'C', label: 'Tidak Puas' },
  ],
};
const qMulti: SurveyQuestionRow = {
  id: 'Q2', position: 2, questionText: 'Fasilitas apa yang sering Anda gunakan? (bisa pilih >1)',
  type: 'MULTIPLE_CHOICE',
  optionsJson: ['A_LAPTOP', 'B_KANTIN', 'C_GYM', 'D_TRANSPORT', 'E_WFH'],
};
const qRating: SurveyQuestionRow = {
  id: 'Q3', position: 3, questionText: 'Rating kepuasan 1-5',
  type: 'RATING_1_5',
};
const qText: SurveyQuestionRow = {
  id: 'Q4', position: 4, questionText: 'Saran & masukan:',
  type: 'TEXT',
};
const QUESTIONS = [qSingle, qMulti, qRating, qText];

describe('D.2 Survey/Polling basic pure functions', () => {
  it('D.2 CASE1: SINGLE_CHOICE 10 jawaban → 60% A, 40% B. 0% C.', () => {
    const submissions: any[][] = [];
    for (let i = 0; i < 6; i++) submissions.push([{ questionId: 'Q1', textValue: 'A' }]);
    for (let i = 0; i < 4; i++) submissions.push([{ questionId: 'Q1', textValue: 'B' }]);
    const agg = calculateSurveyAggregates([qSingle], submissions);
    expect(agg.totalSubmissions).toBe(10);
    const q = agg.byQuestion['Q1'];
    expect(q.totalResponses).toBe(10);
    const A = q.options?.find(o => o.value === 'A');
    const B = q.options?.find(o => o.value === 'B');
    const C = q.options?.find(o => o.value === 'C');
    expect(A?.count).toBe(6);
    expect(A?.percent).toBe(60);
    expect(B?.count).toBe(4);
    expect(B?.percent).toBe(40);
    expect(C?.count).toBe(0);
    expect(C?.percent).toBe(0);
  });

  it('D.2 CASE2: MULTIPLE_CHOICE 5 responden pilih 2-3 pilihan. count tiap option = actual persis.', () => {
    // 5 responden, pilihan masing-masing:
    // R1:A,B / R2:A,C / R3:B,C,D / R4:A,B,C,D / R5:A,E
    // Expected count: A=4, B=3, C=3, D=2, E=1
    const submissions: any[][] = [
      [{ questionId: 'Q2', selectedJson: JSON.stringify(['A_LAPTOP', 'B_KANTIN']) }],
      [{ questionId: 'Q2', selectedJson: ['A_LAPTOP', 'C_GYM'] }],
      [{ questionId: 'Q2', selectedJson: JSON.stringify(['B_KANTIN', 'C_GYM', 'D_TRANSPORT']) }],
      [{ questionId: 'Q2', selectedJson: ['A_LAPTOP', 'B_KANTIN', 'C_GYM', 'D_TRANSPORT'] }],
      [{ questionId: 'Q2', selectedJson: JSON.stringify(['A_LAPTOP', 'E_WFH']) }],
    ];
    const agg = calculateSurveyAggregates([qMulti], submissions);
    const q = agg.byQuestion['Q2'];
    const cnt = (v: string) => q.options?.find(o => o.value === v)?.count ?? -1;
    expect(cnt('A_LAPTOP')).toBe(4);
    expect(cnt('B_KANTIN')).toBe(3);
    expect(cnt('C_GYM')).toBe(3);
    expect(cnt('D_TRANSPORT')).toBe(2);
    expect(cnt('E_WFH')).toBe(1);
    // percent mode multi berbasis SUM total pilihan (4+3+3+2+1=13 total picks), bukan per responden.
    const totalPicks = 13;
    const aPct = Math.round((4 / totalPicks) * 10000) / 100;
    expect(q.options?.find(o => o.value === 'A_LAPTOP')?.percent).toBe(aPct);
  });

  it('D.2 CASE3: aggregate combi semua type. RATING average 4.10 (8 jawaban). TEXT jawaban dikumpulkan jadi array length 7 (1 skipped). skipped counter 2 total semua jawaban Q1-Q4 total.', () => {
    const subs: any[][] = [
      // 1
      [
        { questionId: 'Q1', textValue: 'A' },
        { questionId: 'Q2', selectedJson: JSON.stringify(['A_LAPTOP', 'B_KANTIN']) },
        { questionId: 'Q3', numberValue: 5 },
        { questionId: 'Q4', textValue: 'Bagus' },
      ],
      // 2
      [
        { questionId: 'Q1', textValue: 'A' },
        { questionId: 'Q2', selectedJson: ['C_GYM'] },
        { questionId: 'Q3', numberValue: 4 },
        { questionId: 'Q4', textValue: 'Perbaiki catering' },
      ],
      // 3
      [
        { questionId: 'Q1', textValue: 'B' },
        { questionId: 'Q2', selectedJson: JSON.stringify(['B_KANTIN', 'D_TRANSPORT']) },
        { questionId: 'Q3', numberValue: 5 },
        // Q4 SKIP
      ],
      // 4
      [
        { questionId: 'Q1', textValue: 'C' },
        { questionId: 'Q2', selectedJson: ['E_WFH'] },
        { questionId: 'Q3', numberValue: 2 },
        { questionId: 'Q4', textValue: 'WFH 3x perminggu' },
      ],
      // 5
      [
        { questionId: 'Q1', textValue: 'A' },
        { questionId: 'Q2', selectedJson: JSON.stringify(['A_LAPTOP', 'C_GYM', 'E_WFH']) },
        { questionId: 'Q3', numberValue: 4 },
        { questionId: 'Q4', textValue: 'OK' },
      ],
      // 6
      [
        { questionId: 'Q1', textValue: 'B' },
        { questionId: 'Q2', selectedJson: ['D_TRANSPORT', 'B_KANTIN'] },
        { questionId: 'Q3', numberValue: 5 },
        { questionId: 'Q4', textValue: 'Upgrade wifi meeting room' },
      ],
      // 7
      [
        // user malas: Q2 + Q3 diisi
        { questionId: 'Q2', selectedJson: JSON.stringify(['A_LAPTOP']) },
        { questionId: 'Q3', numberValue: 3 },
      ],
      // 8
      [
        { questionId: 'Q1', textValue: 'A' },
        { questionId: 'Q2', selectedJson: ['C_GYM'] },
        { questionId: 'Q3', numberValue: 5 },
        { questionId: 'Q4', textValue: 'Perpanjang jam gym' },
      ],
    ];
    const agg = calculateSurveyAggregates(QUESTIONS, subs);
    expect(agg.totalSubmissions).toBe(8);
    // Q1 8 submissions totalResponse 7 (sub 7 kosong) skipped=1
    expect(agg.byQuestion['Q1'].skipped).toBe(1);
    expect(agg.byQuestion['Q1'].totalResponses).toBe(7);
    // RATING: 5+4+5+2+4+5+3+5 = 33; 33/8 = 4.125 -> 4.13?
    const rat = agg.byQuestion['Q3'].rating;
    expect(rat?.count).toBe(8);
    const sum = 5 + 4 + 5 + 2 + 4 + 5 + 3 + 5;
    const avg = Math.round((sum / 8) * 100) / 100;
    expect(rat?.average).toBe(avg);
    expect(rat?.distribution[5]).toBe(4); // 5 muncul 4 kali
    // TEXT array length = 6: 1) Bagus 2) Perbaiki catering, 3) skip, 4) WFH 3x perminggu 5) OK, 6) Upgrade wifi, 7) skip, 8) Perpanjang gym = total 6 filled, 2 skipped
    expect(agg.byQuestion['Q4'].textAnswers?.length).toBe(6);
    expect(agg.byQuestion['Q4'].skipped).toBe(2);
  });

  it('D.2 CASE4: Survey status DRAFT = not eligible (reject). status=OPEN start tomorrow = not eligible today.', () => {
    const draft = { companyId: COMPANY_X, status: 'DRAFT' };
    const res1 = isSurveyEligible(draft, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: new Date(2026, 7, 18) });
    expect(res1.eligible).toBe(false);
    expect(res1.reason).toMatch(/DRAFT/);
    // OPEN tapi mulai besok -> today tidak eligible
    const s = { companyId: COMPANY_X, status: 'OPEN', startDate: new Date(2026, 7, 19) };
    const res2 = isSurveyEligible(s, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: new Date(2026, 7, 18) });
    expect(res2.eligible).toBe(false);
    expect(res2.reason).toMatch(/mulai/);
    // OPEN + allowMultiple = false + user sudah pernah submit → reject
    const filled = { companyId: COMPANY_X, status: 'OPEN', allowMultipleSubmission: false };
    const res3 = isSurveyEligible(filled, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, hasRespondedBefore: true });
    expect(res3.eligible).toBe(false);
    expect(res3.reason).toMatch(/sudah pernah/);
  });

  it('D.2 CASE5: Survey sudah closed 3 hari yang lalu → not eligible (endDate passed). Target audience tidak include user BOB → not eligible.', () => {
    const tgl = new Date(2026, 7, 18);
    const closed = { companyId: COMPANY_X, status: 'OPEN', startDate: new Date(2026, 7, 1), endDate: new Date(2026, 7, 15) };
    const rc = isSurveyEligible(closed, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: tgl });
    expect(rc.eligible).toBe(false);
    expect(rc.reason).toMatch(/ditutup/);
    const audienceWrong = {
      companyId: COMPANY_X, status: 'OPEN',
      targetAudienceIds: JSON.stringify(['EMP-ALICE', 'EMP-CHARLIE']),
    };
    const rv = isSurveyEligible(audienceWrong, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: tgl });
    expect(rv.eligible).toBe(false);
    expect(rv.reason).toMatch(/tidak termasuk/);
    // Happy path: OPEN + no target constraint + allowMultiple=false + user belum isi + max belum penuh => ELIGIBLE
    const ok = { companyId: COMPANY_X, status: 'OPEN', allowMultipleSubmission: false, maxResponses: 100, totalResponses: 50 };
    const rOk = isSurveyEligible(ok, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: tgl });
    expect(rOk.eligible).toBe(true);
    expect(rOk.reason).toBeNull();
    // maxResponses 50 total sudah 50 => penuh reject
    const full = { companyId: COMPANY_X, status: 'OPEN', maxResponses: 50, totalResponses: 50 };
    const rFull = isSurveyEligible(full, { companyId: COMPANY_X, employeeId: EMPLOYEE_BOB, currentDate: tgl });
    expect(rFull.eligible).toBe(false);
    expect(rFull.reason).toMatch(/penuh/);
  });
});
