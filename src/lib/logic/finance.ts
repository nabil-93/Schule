import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../supabase/database.types';

/**
 * Standardizes the month label format used across the finance system.
 * Returns YYYY-MM based on the provided date (default today).
 */
export function getMonthLabel(date: Date = new Date()): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

/**
 * Returns the standardized "issued_at" date for a monthly fee record.
 * We use the 1st of the month as a unique identifier.
 */
export function getMonthIssuedAt(monthLabel: string): string {
  return `${monthLabel}-01`;
}

/**
 * SINGLE SOURCE OF TRUTH: Fetch all students who have paid for a specific month.
 * A student is considered "Paid" if they have an invoice with:
 * - status: 'paid'
 * - issued_at: '{month}-01'
 */
export async function getPaidStudentIds(
  supabase: SupabaseClient<Database>,
  monthLabel: string,
): Promise<Set<string>> {
  const issuedAt = getMonthIssuedAt(monthLabel);
  
  const { data, error } = await supabase
    .from('invoices')
    .select('student_id')
    .eq('status', 'paid')
    .eq('issued_at', issuedAt);

  if (error) {
    console.error('[getPaidStudentIds] Error:', error);
    return new Set();
  }

  return new Set(data.map((row: { student_id: string }) => row.student_id));
}

/**
 * Helper to get the human-readable month name from a label.
 */
export function getMonthName(monthLabel: string, locale: string = 'fr'): string {
  const [year, month] = monthLabel.split('-');
  const date = new Date(Number(year), Number(month) - 1, 1);
  return new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);
}
