'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/lib/auth/getCurrentUser';
import { logActivity } from '@/lib/audit/log';
import type { Invoice, InvoiceStatus } from '@/types';
import type { ExpenseCategory } from '@/lib/queries/expenses';

export type InvoiceInput = Omit<Invoice, 'id'>;

export interface ActionResult {
  ok: boolean;
  error?: string;
  id?: string;
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

function normalizeStatus(input: InvoiceInput): {
  status: InvoiceStatus;
  paid_at: string | null;
} {
  if (input.status === 'paid') {
    const today = new Date().toISOString().slice(0, 10);
    return { status: 'paid', paid_at: input.paidAt ?? today };
  }
  return { status: input.status, paid_at: null };
}

export async function createInvoice(input: InvoiceInput): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { status, paid_at } = normalizeStatus(input);

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      student_id: input.studentId,
      amount: input.amount,
      issued_at: input.issuedAt,
      due_date: input.dueDate,
      paid_at,
      status,
      note: input.note?.trim() ? input.note : null,
      created_by: gate.user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  if (status === 'paid') {
    await supabase.from('payments').insert({
      invoice_id: data.id,
      amount: input.amount,
      method: 'cash',
      paid_on: paid_at ?? new Date().toISOString().slice(0, 10),
      recorded_by: gate.user.id,
    });
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_create',
    entityType: 'invoice',
    entityId: data.id,
    metadata: {
      student_id: input.studentId,
      amount: input.amount,
      status,
    },
  });

  // 🔔 Notify parents about the new invoice
  try {
    const { notifyParentsOf } = await import('@/lib/notifications/send');
    await notifyParentsOf(input.studentId, {
      category: 'system',
      type: 'info',
      title: '💳 Neue Rechnung',
      message: `Eine neue Rechnung über ${input.amount} € wurde ausgestellt.`,
      link: '/finance',
    });
  } catch (e) {
    console.error('[createInvoice] notification error:', e);
  }

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id: data.id };
}

export async function updateInvoice(
  id: string,
  input: InvoiceInput,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { status, paid_at } = normalizeStatus(input);

  const { error } = await supabase
    .from('invoices')
    .update({
      student_id: input.studentId,
      amount: input.amount,
      issued_at: input.issuedAt,
      due_date: input.dueDate,
      paid_at,
      status,
      note: input.note?.trim() ? input.note : null,
    })
    .eq('id', id);

  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_update',
    entityType: 'invoice',
    entityId: id,
    metadata: {
      student_id: input.studentId,
      amount: input.amount,
      status,
    },
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id };
}

export async function deleteInvoice(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase.from('invoices').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_delete',
    entityType: 'invoice',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id };
}

export async function markInvoicePaid(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);

  const { data: inv, error: readErr } = await supabase
    .from('invoices')
    .select('amount, paid_at, status')
    .eq('id', id)
    .single();
  if (readErr) return { ok: false, error: readErr.message };

  const { error: updErr } = await supabase
    .from('invoices')
    .update({ status: 'paid', paid_at: inv.paid_at ?? today })
    .eq('id', id);
  if (updErr) return { ok: false, error: updErr.message };

  if (inv.status !== 'paid') {
    await supabase.from('payments').insert({
      invoice_id: id,
      amount: Number(inv.amount),
      method: 'cash',
      paid_on: today,
      recorded_by: gate.user.id,
    });
  }

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_mark_paid',
    entityType: 'invoice',
    entityId: id,
    metadata: { amount: Number(inv.amount), paid_on: today },
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id };
}

export interface ExpenseInput {
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string | null;
}

export async function createExpense(input: ExpenseInput): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('expenses')
    .insert({
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description?.trim() ? input.description : null,
      created_by: gate.user.id,
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'expense_create',
    entityType: 'expense',
    entityId: data.id,
    metadata: { category: input.category, amount: input.amount },
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id: data.id };
}

export async function updateExpense(id: string, input: ExpenseInput): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase
    .from('expenses')
    .update({
      category: input.category,
      amount: input.amount,
      expense_date: input.expenseDate,
      description: input.description?.trim() ? input.description : null,
    })
    .eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'expense_update',
    entityType: 'expense',
    entityId: id,
    metadata: { category: input.category, amount: input.amount },
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id };
}

export async function deleteExpense(id: string): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();
  const { error } = await supabase.from('expenses').delete().eq('id', id);
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'expense_delete',
    entityType: 'expense',
    entityId: id,
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  return { ok: true, id };
}

/* ──────────────────────────────────────────────
   Monthly payment management (class-based view)
   ────────────────────────────────────────────── */

export async function markMonthlyPaid(
  studentId: string,
  month: string,   // "YYYY-MM"
  amount: number,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };
  if (!studentId || !month || amount <= 0) return { ok: false, error: 'invalid_input' };

  const supabase = await createClient();
  const today = new Date().toISOString().slice(0, 10);
  const { getMonthIssuedAt } = await import('@/lib/logic/finance');
  const issuedAt = getMonthIssuedAt(month);
  const lastDayVal = new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate();
  const dueDate = `${month}-${String(lastDayVal).padStart(2, '0')}`;

  // Check if already exists for this student+month
  const { data: existing } = await supabase
    .from('invoices')
    .select('id')
    .eq('student_id', studentId)
    .eq('issued_at', issuedAt)
    .eq('status', 'paid')
    .maybeSingle();
  
  if (existing) return { ok: true, id: existing.id }; // Already paid

  const { data, error } = await supabase
    .from('invoices')
    .insert({
      student_id: studentId,
      amount,
      issued_at: issuedAt,
      due_date: dueDate,
      paid_at: today,
      status: 'paid',
      note: `Monatliche Zahlung ${month}`,
      created_by: gate.user.id,
    })
    .select('id')
    .single();

  if (error) return { ok: false, error: error.message };

  // Also record the payment
  await supabase.from('payments').insert({
    invoice_id: data.id,
    amount,
    method: 'cash',
    paid_on: today,
    recorded_by: gate.user.id,
  });

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_create',
    entityType: 'invoice',
    entityId: data.id,
    metadata: { student_id: studentId, month, amount, is_monthly: true },
  });

  // Notify parents
  try {
    const { notifyParentsOf } = await import('@/lib/notifications/send');
    await notifyParentsOf(studentId, {
      category: 'system',
      type: 'success',
      title: '✅ Zahlung registriert',
      message: `Die Zahlung von ${amount} € für ${month} wurde registriert.`,
      link: `/students/${studentId}`,
    });
  } catch (e) {
    console.error('[markMonthlyPaid] notification error:', e);
  }

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  revalidatePath('/[locale]/(dashboard)/students', 'page');
  revalidatePath('/[locale]/(dashboard)/students/[id]', 'page');
  revalidatePath('/[locale]/(dashboard)/classes/[id]', 'page');
  
  return { ok: true, id: data.id };
}

export async function cancelMonthlyPayment(
  invoiceId: string,
): Promise<ActionResult> {
  const gate = await requireStaff();
  if (!gate.ok) return { ok: false, error: gate.error };

  const supabase = await createClient();

  // Update status to 'cancelled' instead of deleting to preserve history and show in dashboard activity
  const { error } = await supabase
    .from('invoices')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', invoiceId);
    
  if (error) return { ok: false, error: error.message };

  await logActivity({
    actorId: gate.user.id,
    actorRole: gate.user.profile.role,
    actionType: 'invoice_update', // Changed from delete to update
    entityType: 'invoice',
    entityId: invoiceId,
    metadata: { is_monthly_cancel: true, status: 'cancelled' },
  });

  revalidatePath('/[locale]/(dashboard)/finance', 'page');
  revalidatePath('/[locale]/(dashboard)/students', 'page');
  revalidatePath('/[locale]/(dashboard)/students/[id]', 'page');
  revalidatePath('/[locale]/(dashboard)/classes/[id]', 'page');

  return { ok: true, id: invoiceId };
}
