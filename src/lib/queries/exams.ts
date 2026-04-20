import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Exam, ExamResult, ExamType, ExamSubmission } from '@/types';

type ExamRow = {
  id: string;
  subject: string;
  class_id: string;
  date: string;
  type: string;
  total_points: number;
  coefficient: number;
  attachment_url?: string | null;
  attachment_name?: string | null;
  attachment_mime?: string | null;
};

type ResultRow = {
  id: string;
  exam_id: string;
  student_id: string;
  score: number;
};

export const EXAM_SELECT =
  'id, subject, class_id, date, type, total_points, coefficient, attachment_url, attachment_name, attachment_mime';
export const EXAM_RESULT_SELECT = 'id, exam_id, student_id, score';
export const EXAM_SUBMISSION_SELECT = 'id, exam_id, student_id, answer_text, attachment_url, attachment_name, attachment_mime, submitted_at, grade_status';

export function rowToExam(row: ExamRow): Exam {
  return {
    id: row.id,
    subject: row.subject,
    classId: row.class_id,
    date: row.date,
    type: row.type as ExamType,
    totalPoints: Number(row.total_points),
    coefficient: Number(row.coefficient ?? 1),
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
  };
}

export function rowToSubmission(row: any): ExamSubmission {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    answerText: row.answer_text,
    attachmentUrl: row.attachment_url,
    attachmentName: row.attachment_name,
    attachmentMime: row.attachment_mime,
    submittedAt: row.submitted_at,
    gradeStatus: row.grade_status as 'pending' | 'graded',
  };
}

export function rowToResult(row: ResultRow): ExamResult {
  return {
    id: row.id,
    examId: row.exam_id,
    studentId: row.student_id,
    score: Number(row.score),
  };
}

export async function listExams(client: SupabaseClient<Database>): Promise<Exam[]> {
  const { data, error } = await client
    .from('exams')
    .select(EXAM_SELECT)
    .order('date', { ascending: false });
  if (error) throw error;
  return (data as unknown as ExamRow[]).map(rowToExam);
}

export async function listExamResults(client: SupabaseClient<Database>): Promise<ExamResult[]> {
  const { data, error } = await client
    .from('exam_results')
    .select(EXAM_RESULT_SELECT);
  if (error) throw error;
  return (data as unknown as ResultRow[]).map(rowToResult);
}

export async function listResultsForExam(
  client: SupabaseClient<Database>,
  examId: string,
): Promise<ExamResult[]> {
  const { data, error } = await client
    .from('exam_results')
    .select(EXAM_RESULT_SELECT)
    .eq('exam_id', examId);
  if (error) throw error;
  return (data as unknown as ResultRow[]).map(rowToResult);
}

export interface UiStudentResult {
  id: string;
  examId: string;
  score: number;
  examSubject: string;
  examType: ExamType;
  examDate: string;
  examTotalPoints: number;
}

type JoinedResultRow = {
  id: string;
  exam_id: string;
  score: number;
  exam: ExamRow | null;
};

export async function listResultsForStudent(
  client: SupabaseClient<Database>,
  studentId: string,
): Promise<UiStudentResult[]> {
  const { data, error } = await client
    .from('exam_results')
    .select(
      'id, exam_id, score, exam:exams!exam_results_exam_id_fkey(id, subject, class_id, date, type, total_points, coefficient)',
    )
    .eq('student_id', studentId);
  if (error) throw error;
  const rows = (data ?? []) as unknown as JoinedResultRow[];
  return rows
    .filter((r) => !!r.exam)
    .map((r) => ({
      id: r.id,
      examId: r.exam_id,
      score: Number(r.score),
      examSubject: r.exam!.subject,
      examType: r.exam!.type as ExamType,
      examDate: r.exam!.date,
      examTotalPoints: Number(r.exam!.total_points),
    }))
    .sort((a, b) => b.examDate.localeCompare(a.examDate));
}

export async function listSubmissionsForExam(
  client: SupabaseClient<Database>,
  examId: string,
): Promise<ExamSubmission[]> {
  const { data, error } = await client
    .from('exam_submissions')
    .select(EXAM_SUBMISSION_SELECT)
    .eq('exam_id', examId);
  if (error) throw error;
  return (data as any[]).map(rowToSubmission);
}

export async function getSubmissionForStudent(
  client: SupabaseClient<Database>,
  examId: string,
  studentId: string,
): Promise<ExamSubmission | null> {
  const { data, error } = await client
    .from('exam_submissions')
    .select(EXAM_SUBMISSION_SELECT)
    .eq('exam_id', examId)
    .eq('student_id', studentId)
    .maybeSingle();
  if (error) throw error;
  return data ? rowToSubmission(data) : null;
}

