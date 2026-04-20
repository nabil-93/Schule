'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';

export interface ActionResult {
  ok: boolean;
  error?: string;
}

export interface CreateClassResult extends ActionResult {
  id?: string;
}

export interface ClassInput {
  name: string;
  level: string;
  room: string;
  capacity: number;
  academicYear: string;
  homeroomTeacherId: string | null;
}

function genId(): string {
  return `c-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

async function requireStaff() {
  const user = await getCurrentUser();
  if (!user) return { ok: false as const, error: 'not_authenticated' };
  const { role, is_director } = user.profile;
  if (!is_director && role !== 'mitarbeiter') {
    return { ok: false as const, error: 'forbidden' };
  }
  return { ok: true as const, user };
}

export async function setClassTeachers(
  classId: string,
  teacherIds: string[],
  homeroomTeacherId: string | null,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const unique = Array.from(new Set(teacherIds));

  const { error: delErr } = await supabase
    .from('class_teachers')
    .delete()
    .eq('class_id', classId);
  if (delErr) return { ok: false, error: delErr.message };

  if (unique.length === 0) {
    revalidatePath(`/classes/${classId}`);
    return { ok: true };
  }

  const rows = unique.map((tid) => ({
    class_id: classId,
    teacher_id: tid,
    is_homeroom: tid === homeroomTeacherId,
  }));
  const { error: insErr } = await supabase.from('class_teachers').insert(rows);
  if (insErr) return { ok: false, error: insErr.message };

  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function setHomeroomTeacher(
  classId: string,
  homeroomTeacherId: string | null,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { data: existing, error: listErr } = await supabase
    .from('class_teachers')
    .select('teacher_id, is_homeroom')
    .eq('class_id', classId);
  if (listErr) return { ok: false, error: listErr.message };

  const rows = (existing ?? []) as { teacher_id: string; is_homeroom: boolean }[];
  const existingIds = new Set(rows.map((r) => r.teacher_id));

  const { error: clearErr } = await supabase
    .from('class_teachers')
    .update({ is_homeroom: false })
    .eq('class_id', classId)
    .neq('teacher_id', homeroomTeacherId ?? '00000000-0000-0000-0000-000000000000');
  if (clearErr) return { ok: false, error: clearErr.message };

  if (homeroomTeacherId) {
    if (existingIds.has(homeroomTeacherId)) {
      const { error: upErr } = await supabase
        .from('class_teachers')
        .update({ is_homeroom: true })
        .eq('class_id', classId)
        .eq('teacher_id', homeroomTeacherId);
      if (upErr) return { ok: false, error: upErr.message };
    } else {
      const { error: insErr } = await supabase.from('class_teachers').insert({
        class_id: classId,
        teacher_id: homeroomTeacherId,
        is_homeroom: true,
      });
      if (insErr) return { ok: false, error: insErr.message };
    }
  }

  revalidatePath('/classes');
  revalidatePath(`/classes/${classId}`);
  return { ok: true };
}

export async function createClass(input: ClassInput): Promise<CreateClassResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const id = genId();
  const { error } = await supabase.from('classes').insert({
    id,
    name: input.name,
    level: input.level,
    room: input.room,
    capacity: input.capacity,
    academic_year: input.academicYear,
    homeroom_teacher_id: input.homeroomTeacherId,
  });
  if (error) return { ok: false, error: error.message };

  if (input.homeroomTeacherId) {
    await supabase.from('class_teachers').insert({
      class_id: id,
      teacher_id: input.homeroomTeacherId,
      is_homeroom: true,
    });
  }

  revalidatePath('/classes');
  return { ok: true, id };
}

export async function updateClass(
  id: string,
  input: ClassInput,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('classes')
    .update({
      name: input.name,
      level: input.level,
      room: input.room,
      capacity: input.capacity,
      academic_year: input.academicYear,
      homeroom_teacher_id: input.homeroomTeacherId,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  const { data: existing } = await supabase
    .from('class_teachers')
    .select('teacher_id, is_homeroom')
    .eq('class_id', id);

  await supabase
    .from('class_teachers')
    .update({ is_homeroom: false })
    .eq('class_id', id);

  if (input.homeroomTeacherId) {
    const rows = (existing ?? []) as { teacher_id: string }[];
    const has = rows.some((r) => r.teacher_id === input.homeroomTeacherId);
    if (has) {
      await supabase
        .from('class_teachers')
        .update({ is_homeroom: true })
        .eq('class_id', id)
        .eq('teacher_id', input.homeroomTeacherId);
    } else {
      await supabase.from('class_teachers').insert({
        class_id: id,
        teacher_id: input.homeroomTeacherId,
        is_homeroom: true,
      });
    }
  }

  revalidatePath('/classes');
  revalidatePath(`/classes/${id}`);
  return { ok: true };
}

export async function deleteClass(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  const { count } = await supabase
    .from('students')
    .select('profile_id', { count: 'exact', head: true })
    .eq('class_id', id);
  if (count && count > 0) return { ok: false, error: 'has_students' };

  await supabase.from('class_teachers').delete().eq('class_id', id);
  const { error } = await supabase.from('classes').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  revalidatePath('/classes');
  return { ok: true };
}
