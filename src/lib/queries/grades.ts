import type { Exam, ExamResult } from '@/types';

/**
 * Normalize a raw score (out of exam.totalPoints) to a standard 20-point scale.
 * Returns null when the exam has no meaningful total.
 */
export function normalizeTo20(score: number, totalPoints: number): number | null {
  if (!Number.isFinite(score) || !Number.isFinite(totalPoints) || totalPoints <= 0) {
    return null;
  }
  const n = (score / totalPoints) * 20;
  return Math.max(0, Math.min(20, n));
}

export interface SubjectAverage {
  subject: string;
  /** Weighted mean of normalized scores (/20) across exams of this subject taken by the student. */
  average20: number;
  /** Sum of coefficients used in the weighted mean. */
  coefficient: number;
  /** How many exams contributed. */
  examCount: number;
}

export interface ExamEntry {
  exam: Exam;
  result: ExamResult | null;
  normalized20: number | null;
}

export interface StudentReport {
  studentId: string;
  classId: string | null;
  /** Weighted overall average /20 across all exams with a recorded score. */
  overall20: number | null;
  /** Exams with a recorded score. */
  takenCount: number;
  /** Total exams published for the student's class. */
  totalExams: number;
  subjects: SubjectAverage[];
  exams: ExamEntry[];
}

function weightedMean(pairs: Array<{ value: number; weight: number }>): number | null {
  let num = 0;
  let den = 0;
  for (const p of pairs) {
    if (p.weight <= 0) continue;
    num += p.value * p.weight;
    den += p.weight;
  }
  if (den === 0) return null;
  return num / den;
}

/**
 * Build a report for one student. `classId` is the student's enrolled class; only exams
 * matching that class contribute. If null, no exams are considered (empty report).
 */
export function buildStudentReport(
  studentId: string,
  classId: string | null,
  exams: Exam[],
  results: ExamResult[],
): StudentReport {
  const classExams = classId
    ? exams.filter((e) => e.classId === classId)
    : [];

  const resultByExam = new Map<string, ExamResult>();
  for (const r of results) {
    if (r.studentId === studentId) resultByExam.set(r.examId, r);
  }

  const examEntries: ExamEntry[] = classExams.map((exam) => {
    const result = resultByExam.get(exam.id) ?? null;
    const normalized20 = result ? normalizeTo20(result.score, exam.totalPoints) : null;
    return { exam, result, normalized20 };
  });

  // Overall: weight each normalized exam score by its coefficient.
  const overallPairs = examEntries
    .filter((e): e is ExamEntry & { normalized20: number } => e.normalized20 !== null)
    .map((e) => ({ value: e.normalized20, weight: e.exam.coefficient }));
  const overall20 = weightedMean(overallPairs);

  // Per subject: group normalized exam scores and compute weighted avg within the group.
  const bySubject = new Map<string, ExamEntry[]>();
  for (const entry of examEntries) {
    const list = bySubject.get(entry.exam.subject) ?? [];
    list.push(entry);
    bySubject.set(entry.exam.subject, list);
  }

  const subjects: SubjectAverage[] = [];
  for (const [subject, entries] of bySubject) {
    const scored = entries.filter(
      (e): e is ExamEntry & { normalized20: number } => e.normalized20 !== null,
    );
    if (scored.length === 0) continue;
    const pairs = scored.map((e) => ({
      value: e.normalized20,
      weight: e.exam.coefficient,
    }));
    const avg = weightedMean(pairs);
    if (avg === null) continue;
    const coefSum = scored.reduce((s, e) => s + e.exam.coefficient, 0);
    subjects.push({
      subject,
      average20: avg,
      coefficient: coefSum,
      examCount: scored.length,
    });
  }
  subjects.sort((a, b) => a.subject.localeCompare(b.subject));

  const takenCount = overallPairs.length;

  return {
    studentId,
    classId,
    overall20,
    takenCount,
    totalExams: classExams.length,
    subjects,
    exams: examEntries,
  };
}

export interface ClassRow {
  studentId: string;
  overall20: number | null;
  takenCount: number;
  totalExams: number;
  rank: number | null;
}

/**
 * Compute per-student overview rows for a class, ranked by overall average (desc).
 * Students with no scores get rank = null and overall20 = null.
 */
export function buildClassOverview(
  classId: string,
  studentIds: string[],
  exams: Exam[],
  results: ExamResult[],
): ClassRow[] {
  const rows = studentIds.map((sid) => {
    const report = buildStudentReport(sid, classId, exams, results);
    return {
      studentId: sid,
      overall20: report.overall20,
      takenCount: report.takenCount,
      totalExams: report.totalExams,
    };
  });

  const scored = rows
    .filter((r): r is typeof r & { overall20: number } => r.overall20 !== null)
    .sort((a, b) => b.overall20 - a.overall20);

  const rankById = new Map<string, number>();
  scored.forEach((r, i) => rankById.set(r.studentId, i + 1));

  return rows.map((r) => ({ ...r, rank: rankById.get(r.studentId) ?? null }));
}

export function mention(overall20: number): 'excellent' | 'good' | 'fair' | 'pass' | 'fail' {
  if (overall20 >= 16) return 'excellent';
  if (overall20 >= 14) return 'good';
  if (overall20 >= 12) return 'fair';
  if (overall20 >= 10) return 'pass';
  return 'fail';
}
