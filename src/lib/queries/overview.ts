import type { Exam, ExamResult, Invoice, Student, TimeRange } from '@/types';
import { buildStudentReport, mention, normalizeTo20 } from './grades';

export interface OverviewKpis {
  studentsTotal: number;
  studentsActive: number;
  revenueAllPaid: number;
  revenueThisMonth: number;
  attendanceAvg: number;
  gradeAvg20: number | null;
  overdueCount: number;
  pendingCount: number;
  examsCount: number;
  resultsCount: number;
}

export interface MonthlyPaymentPoint {
  month: string;
  paid: number;
  pending: number;
  overdue: number;
}

export interface SubjectAveragePoint {
  subject: string;
  average20: number;
  examCount: number;
}

export type Mention = 'excellent' | 'good' | 'fair' | 'pass' | 'fail';

export interface GradeDistributionPoint {
  mention: Mention;
  count: number;
}

export type ActivityKind = 'invoice_paid' | 'invoice_cancelled' | 'exam_created' | 'student_enrolled';

export interface ActivityItem {
  id: string;
  kind: ActivityKind;
  at: string;
  primary: string;
  secondary: string;
  amount?: number;
  status?: string;
}

function monthKey(iso: string): string {
  return iso.slice(0, 7);
}

function monthLabel(key: string): string {
  return key;
}

export function buildOverviewKpis(
  students: Student[],
  invoices: Invoice[],
  exams: Exam[],
  results: ExamResult[],
): OverviewKpis {
  const { getMonthLabel } = require('../logic/finance');
  const currentMonth = getMonthLabel(new Date());

  let revenueAllPaid = 0;
  let revenueThisMonth = 0;
  let overdueCount = 0;
  let pendingCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'paid') {
      revenueAllPaid += inv.amount;
      const ref = inv.paidAt ?? inv.issuedAt;
      if (ref && monthKey(ref) === currentMonth) revenueThisMonth += inv.amount;
    } else if (inv.status === 'pending') {
      pendingCount += 1;
    } else if (inv.status === 'overdue') {
      overdueCount += 1;
    }
  }

  const attendanceSum = students.reduce((acc, s) => acc + (s.attendanceRate ?? 0), 0);
  const attendanceAvg = students.length ? attendanceSum / students.length : 0;

  const perStudent: number[] = [];
  for (const s of students) {
    if (!s.classId) continue;
    const report = buildStudentReport(s.id, s.classId, exams, results);
    if (report.overall20 !== null) perStudent.push(report.overall20);
  }
  const gradeAvg20 = perStudent.length
    ? perStudent.reduce((a, b) => a + b, 0) / perStudent.length
    : null;

  const studentsActive = students.filter((s) => s.status !== 'inactive').length;

  return {
    studentsTotal: students.length,
    studentsActive,
    revenueAllPaid,
    revenueThisMonth,
    attendanceAvg,
    gradeAvg20,
    overdueCount,
    pendingCount,
    examsCount: exams.length,
    resultsCount: results.length,
  };
}

/**
 * Group invoices by the month of their issue/paid date.
 */
export function buildMonthlyPayments(
  invoices: Invoice[],
  range: TimeRange | number = '6m',
): MonthlyPaymentPoint[] {
  const now = new Date();
  const buckets: Record<string, MonthlyPaymentPoint> = {};
  const order: string[] = [];
  
  let steps = 6;
  let unit: 'day' | 'month' = 'month';

  if (typeof range === 'number') {
    steps = range;
    unit = 'month';
  } else {
    if (range === '7d') { steps = 7; unit = 'day'; }
    else if (range === '30d') { steps = 30; unit = 'day'; }
    else if (range === '6m') { steps = 6; unit = 'month'; }
    else if (range === '1y') { steps = 12; unit = 'month'; }
  }

  for (let i = steps - 1; i >= 0; i--) {
    let d: Date;
    let key: string;
    if (unit === 'month') {
      d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
      key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
    } else {
      d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      key = d.toISOString().split('T')[0];
    }
    buckets[key] = { month: key, paid: 0, pending: 0, overdue: 0 };
    order.push(key);
  }

  for (const inv of invoices) {
    const ref = inv.status === 'paid' ? inv.paidAt ?? inv.issuedAt : inv.issuedAt;
    if (!ref) continue;
    const key = unit === 'month' ? monthKey(ref) : ref.split('T')[0];
    const bucket = buckets[key];
    if (!bucket) continue;
    if (inv.status === 'paid') bucket.paid += inv.amount;
    else if (inv.status === 'pending') bucket.pending += inv.amount;
    else if (inv.status === 'overdue') bucket.overdue += inv.amount;
  }

  return order.map((k) => buckets[k]);
}

/**
 * Average /20 per subject across all recorded results.
 * Each result contributes with its exam's coefficient.
 */
export function buildSubjectAverages(
  exams: Exam[],
  results: ExamResult[],
): SubjectAveragePoint[] {
  const examById = new Map(exams.map((e) => [e.id, e]));
  const agg = new Map<string, { num: number; den: number; count: number }>();

  for (const r of results) {
    const exam = examById.get(r.examId);
    if (!exam) continue;
    const normalized = normalizeTo20(r.score, exam.totalPoints);
    if (normalized === null) continue;
    const weight = exam.coefficient > 0 ? exam.coefficient : 1;
    const cur = agg.get(exam.subject) ?? { num: 0, den: 0, count: 0 };
    cur.num += normalized * weight;
    cur.den += weight;
    cur.count += 1;
    agg.set(exam.subject, cur);
  }

  const out: SubjectAveragePoint[] = [];
  for (const [subject, v] of agg) {
    if (v.den === 0) continue;
    out.push({ subject, average20: v.num / v.den, examCount: v.count });
  }
  out.sort((a, b) => b.average20 - a.average20);
  return out;
}

export function buildGradeDistribution(
  students: Student[],
  exams: Exam[],
  results: ExamResult[],
): GradeDistributionPoint[] {
  const counts: Record<Mention, number> = {
    excellent: 0,
    good: 0,
    fair: 0,
    pass: 0,
    fail: 0,
  };
  for (const s of students) {
    if (!s.classId) continue;
    const report = buildStudentReport(s.id, s.classId, exams, results);
    if (report.overall20 === null) continue;
    counts[mention(report.overall20)] += 1;
  }
  return (Object.keys(counts) as Mention[]).map((m) => ({ mention: m, count: counts[m] }));
}

export function buildRecentActivity(
  students: Student[],
  invoices: Invoice[],
  exams: Exam[],
  limit = 12,
): ActivityItem[] {
  const items: ActivityItem[] = [];

  for (const inv of invoices) {
    if (inv.status === 'paid') {
      items.push({
        id: `inv:${inv.id}`,
        kind: 'invoice_paid',
        at: inv.paidAt ?? inv.issuedAt,
        primary: inv.studentId,
        secondary: inv.id,
        amount: inv.amount,
      });
    } else if (inv.status === 'cancelled') {
      items.push({
        id: `inv-can:${inv.id}`,
        kind: 'invoice_cancelled',
        at: inv.updatedAt || inv.issuedAt, // Assuming updatedAt exists in DB or using issuedAt
        primary: inv.studentId,
        secondary: inv.id,
        amount: inv.amount,
        status: 'Storniert'
      });
    }
  }

  for (const exam of exams) {
    items.push({
      id: `exam:${exam.id}`,
      kind: 'exam_created',
      at: exam.date,
      primary: exam.subject,
      secondary: exam.classId,
    });
  }

  for (const s of students) {
    if (s.status === 'new' || s.status === 'active') {
      items.push({
        id: `stu:${s.id}`,
        kind: 'student_enrolled',
        at: s.dateOfBirth || '', // Use some date if available
        primary: s.fullName,
        secondary: s.admissionNo,
      });
    }
  }

  // Filter out items with empty 'at' and sort
  return items
    .filter(i => !!i.at)
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, limit);
}
