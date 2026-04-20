'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import {
  notifyClassStudents,
  notifyClassTeachers,
  notifyClassParents,
  sendNotification,
} from '@/lib/notifications/send';
import type { Exam, ExamType } from '@/types';

export type ExamInput = Omit<Exam, 'id'>;

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
}

/**
 * Allow staff (all classes) or a teacher assigned to the given class.
 * Pass `classId = null` to only allow staff.
 */
async function requireClassAccess(classId: string | null) {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: 'not_authenticated' };
  const { role, is_director } = user.profile;
  if (is_director || role === 'mitarbeiter') return { ok: true as const, user };
  if (role !== 'teacher' || !classId) {
    return { ok: false as const, error: 'forbidden' };
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('class_teachers')
    .select('class_id')
    .eq('teacher_id', user.id)
    .eq('class_id', classId)
    .maybeSingle();
  if (error) return { ok: false as const, error: error.message };
  if (!data) return { ok: false as const, error: 'forbidden' };
  return { ok: true as const, user };
}

function sanitize(input: ExamInput) {
  const subject = input.subject.trim();
  const type: ExamType = input.type;
  const total = Number(input.totalPoints);
  const coef = Number(input.coefficient);
  return {
    subject,
    class_id: input.classId,
    date: input.date,
    type,
    total_points: Number.isFinite(total) && total > 0 ? total : 20,
    coefficient: Number.isFinite(coef) && coef > 0 ? coef : 1,
    attachment_url: input.attachmentUrl || null,
    attachment_name: input.attachmentName || null,
    attachment_mime: input.attachmentMime || null,
  };
}

export async function createExam(input: ExamInput): Promise<ActionResult> {
  if (!input.subject.trim() || !input.classId || !input.date) {
    return { ok: false, error: 'invalid_input' };
  }
  const gate = await requireClassAccess(input.classId);
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const payload = sanitize(input);

  const { data, error } = await supabase
    .from('exams')
    .insert({ ...payload, created_by: gate.user.id })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'exam_create',
    entityType: 'exam',
    entityId: data.id,
    metadata: { subject: payload.subject, type: payload.type, date: payload.date },
  });

  // 🔔 Notify students & parents in this class about the new exam
  const notifPayload = {
    category: 'exam' as const,
    type: 'info' as const,
    title: `📝 Nouvel examen : ${payload.subject}`,
    message: `Prévu le ${payload.date} — ${payload.type === 'final' ? 'Examen final' : payload.type === 'midterm' ? 'Mi-parcours' : 'Contrôle'}`,
    link: '/exams',
  };
  await notifyClassStudents(input.classId, notifPayload, gate.user.id);
  await notifyClassParents(input.classId, notifPayload);

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true, id: data.id };
}

export async function updateExam(id: string, input: ExamInput): Promise<ActionResult> {
  if (!input.subject.trim() || !input.classId || !input.date) {
    return { ok: false, error: 'invalid_input' };
  }
  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from('exams')
    .select('class_id')
    .eq('id', id)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const gateOrig = await requireClassAccess(existing.class_id);
  if (!gateOrig.ok) return { ok: false, error: gateOrig.error };
  if (existing.class_id !== input.classId) {
    const gateNew = await requireClassAccess(input.classId);
    if (!gateNew.ok) return { ok: false, error: gateNew.error };
  }
  const gate = gateOrig;

  const payload = sanitize(input);

  const { error } = await supabase.from('exams').update(payload).eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'exam_update',
    entityType: 'exam',
    entityId: id,
    metadata: { subject: payload.subject, type: payload.type, date: payload.date },
  });

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true, id };
}

export async function deleteExam(id: string): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: existing, error: readErr } = await supabase
    .from('exams')
    .select('class_id')
    .eq('id', id)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const gate = await requireClassAccess(existing.class_id);
  if (!gate.ok) return { ok: false, error: gate.error };

  const { error } = await supabase.from('exams').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'exam_delete',
    entityType: 'exam',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true, id };
}

export async function upsertExamResult(
  examId: string,
  studentId: string,
  score: number,
): Promise<ActionResult> {
  if (!examId || !studentId) return { ok: false, error: 'invalid_input' };
  const s = Number(score);
  if (!Number.isFinite(s) || s < 0) return { ok: false, error: 'invalid_score' };

  const supabase = await createClient();

  const { data: exam, error: readErr } = await supabase
    .from('exams')
    .select('total_points, class_id')
    .eq('id', examId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const gate = await requireClassAccess(exam.class_id);
  if (!gate.ok) return { ok: false, error: gate.error };

  const clamped = Math.min(s, Number(exam.total_points));

  const { data, error } = await supabase
    .from('exam_results')
    .upsert(
      {
        exam_id: examId,
        student_id: studentId,
        score: clamped,
        graded_by: gate.user.id,
        graded_at: new Date().toISOString(),
      },
      { onConflict: 'exam_id,student_id' },
    )
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'grade_upsert',
    entityType: 'exam_result',
    entityId: data.id,
    metadata: { exam_id: examId, student_id: studentId, score: clamped },
  });

  // 🔔 Notify the student that their grade was published
  await sendNotification(studentId, {
    category: 'grade',
    type: 'success',
    title: '📊 Note publiée',
    message: `Vous avez obtenu ${clamped}/${exam.total_points}`,
    link: '/exams',
  });

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true, id: data.id };
}

export async function deleteExamResult(
  examId: string,
  studentId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { data: exam, error: readErr } = await supabase
    .from('exams')
    .select('class_id')
    .eq('id', examId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const gate = await requireClassAccess(exam.class_id);
  if (!gate.ok) return { ok: false, error: gate.error };
  const { error } = await supabase
    .from('exam_results')
    .delete()
    .eq('exam_id', examId)
    .eq('student_id', studentId);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'grade_delete',
    entityType: 'exam_result',
    metadata: { exam_id: examId, student_id: studentId },
  });

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true };
}

export interface ScoreEntry {
  studentId: string;
  /** Send `null` to delete the score for this student. */
  score: number | null;
}

/**
 * Batch save all score edits for an exam in one server roundtrip.
 * Caller clamps against total_points server-side; we re-clamp as defense.
 */
export async function saveExamResults(
  examId: string,
  entries: ScoreEntry[],
): Promise<ActionResult> {
  if (!examId) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const { data: exam, error: readErr } = await supabase
    .from('exams')
    .select('total_points, class_id')
    .eq('id', examId)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const gate = await requireClassAccess(exam.class_id);
  if (!gate.ok) return { ok: false, error: gate.error };

  const totalPoints = Number(exam.total_points);
  const toUpsert = entries
    .filter((e) => e.score !== null && Number.isFinite(Number(e.score)))
    .map((e) => ({
      exam_id: examId,
      student_id: e.studentId,
      score: Math.max(0, Math.min(totalPoints, Number(e.score))),
      graded_by: gate.user.id,
      graded_at: new Date().toISOString(),
    }));
  const toDelete = entries.filter((e) => e.score === null).map((e) => e.studentId);

  if (toUpsert.length > 0) {
    const { error } = await supabase
      .from('exam_results')
      .upsert(toUpsert, { onConflict: 'exam_id,student_id' });
    if (error) return { ok: false, error: error.message };
  }
  if (toDelete.length > 0) {
    const { error } = await supabase
      .from('exam_results')
      .delete()
      .eq('exam_id', examId)
      .in('student_id', toDelete);
    if (error) return { ok: false, error: error.message };
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'grade_upsert',
    entityType: 'exam_result',
    metadata: { exam_id: examId, upserted: toUpsert.length, deleted: toDelete.length },
  });

  // 🔔 Notify each graded student
  for (const entry of toUpsert) {
    await sendNotification(entry.student_id, {
      category: 'grade',
      type: 'success',
      title: '📊 Note publiée',
      message: `Vous avez obtenu ${entry.score}/${totalPoints}`,
      link: '/exams',
    });
  }

  revalidatePath('/[locale]/(dashboard)/exams', 'page');
  return { ok: true };
}

export async function saveStudentSubmission({
  examId,
  studentId,
  answerText,
  attachmentUrl,
  attachmentName,
  attachmentMime,
}: {
  examId: string;
  studentId: string;
  answerText?: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  attachmentMime?: string | null;
}): Promise<ActionResult> {
  const supabase = await createClient();
  const user = await getCurrentUser();
  if (!user || user.id !== studentId) return { ok: false, error: 'forbidden' };

  const { data, error } = await supabase
    .from('exam_submissions')
    .upsert({
      id: undefined, // wait, usually upsert requires a unique key like (exam_id, student_id)
      exam_id: examId,
      student_id: studentId,
      answer_text: answerText || null,
      attachment_url: attachmentUrl || null,
      attachment_name: attachmentName || null,
      attachment_mime: attachmentMime || null,
      submitted_at: new Date().toISOString(),
    }, { onConflict: 'exam_id,student_id' })
    .select('id')
    .maybeSingle();

  if (error) {
    // If table doesn't have a unique constraint on exam_id, student_id, upsert might fail.
    // Let's do a select then insert/update to be safe in Supabase if no unique constraint exists.
    const { data: existing } = await supabase
      .from('exam_submissions')
      .select('id')
      .eq('exam_id', examId)
      .eq('student_id', studentId)
      .maybeSingle();

    if (existing) {
      const { error: updErr } = await supabase.from('exam_submissions').update({
        answer_text: answerText || null,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        attachment_mime: attachmentMime || null,
        submitted_at: new Date().toISOString(),
      }).eq('id', existing.id);
      if (updErr) return { ok: false, error: updErr.message };
    } else {
      const { error: insErr } = await supabase.from('exam_submissions').insert({
        exam_id: examId,
        student_id: studentId,
        answer_text: answerText || null,
        attachment_url: attachmentUrl || null,
        attachment_name: attachmentName || null,
        attachment_mime: attachmentMime || null,
      });
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  await logActivity({
    actorId: user.id,
    actorRole: user.profile.role,
    actionType: 'exam_submit',
    entityType: 'exam_submission',
    metadata: { exam_id: examId },
  });

  // 🔔 Notify teachers of this class that a student submitted
  // First, get the exam's class_id
  const { data: examRow } = await supabase
    .from('exams')
    .select('class_id, subject')
    .eq('id', examId)
    .maybeSingle();
  if (examRow?.class_id) {
    await notifyClassTeachers(examRow.class_id, {
      category: 'submission',
      type: 'info',
      title: '📩 Réponse reçue',
      message: `${user.profile.full_name} a soumis sa réponse pour « ${examRow.subject} »`,
      link: '/exams',
    }, user.id);
  }

  return { ok: true };
}
