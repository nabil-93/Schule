import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';
import type { Invoice, InvoiceStatus } from '@/types';

type Row = {
  id: string;
  student_id: string;
  amount: number;
  issued_at: string;
  due_date: string;
  paid_at: string | null;
  status: string;
  note: string | null;
  updated_at: string;
};

export const INVOICE_SELECT =
  'id, student_id, amount, issued_at, due_date, paid_at, status, note, updated_at';

export function rowToInvoice(row: Row): Invoice {
  return {
    id: row.id,
    studentId: row.student_id,
    amount: Number(row.amount),
    issuedAt: row.issued_at,
    dueDate: row.due_date,
    paidAt: row.paid_at,
    status: row.status as InvoiceStatus,
    note: row.note ?? undefined,
    updatedAt: row.updated_at,
  };
}

export async function listInvoices(client: SupabaseClient<Database>): Promise<Invoice[]> {
  const { data, error } = await client
    .from('invoices')
    .select(INVOICE_SELECT)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToInvoice);
}

export async function listInvoicesForStudent(
  client: SupabaseClient<Database>,
  studentId: string,
): Promise<Invoice[]> {
  const { data, error } = await client
    .from('invoices')
    .select(INVOICE_SELECT)
    .eq('student_id', studentId)
    .order('issued_at', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToInvoice);
}
