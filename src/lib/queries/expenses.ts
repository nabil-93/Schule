import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/lib/supabase/database.types';

export const EXPENSE_CATEGORIES = [
  'salaries',
  'rent',
  'utilities',
  'supplies',
  'maintenance',
  'transport',
  'other',
] as const;

export type ExpenseCategory = (typeof EXPENSE_CATEGORIES)[number];

export interface Expense {
  id: string;
  category: ExpenseCategory;
  amount: number;
  expenseDate: string;
  description: string | null;
  receiptUrl: string | null;
  createdBy: string | null;
  createdAt: string;
}

type Row = {
  id: string;
  category: string;
  amount: number;
  expense_date: string;
  description: string | null;
  receipt_url: string | null;
  created_by: string | null;
  created_at: string;
};

export const EXPENSE_SELECT =
  'id, category, amount, expense_date, description, receipt_url, created_by, created_at';

export function rowToExpense(row: Row): Expense {
  return {
    id: row.id,
    category: row.category as ExpenseCategory,
    amount: Number(row.amount),
    expenseDate: row.expense_date,
    description: row.description,
    receiptUrl: row.receipt_url,
    createdBy: row.created_by,
    createdAt: row.created_at,
  };
}

export async function listExpenses(client: SupabaseClient<Database>): Promise<Expense[]> {
  const { data, error } = await client
    .from('expenses')
    .select(EXPENSE_SELECT)
    .order('expense_date', { ascending: false });
  if (error) throw error;
  return (data as unknown as Row[]).map(rowToExpense);
}
