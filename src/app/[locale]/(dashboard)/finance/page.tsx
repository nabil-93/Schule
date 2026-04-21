import { setRequestLocale } from 'next-intl/server';
import { createClient } from '@/lib/supabase/server';
import { listInvoices } from '@/lib/queries/invoices';
import { listStudents } from '@/lib/queries/students';
import { listClasses } from '@/lib/queries/classes';
import { listExpenses, type Expense } from '@/lib/queries/expenses';
import type { Invoice, SchoolClass, Student } from '@/types';
import { FinanceShell } from './FinanceShell';

export default async function Page({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);

  const supabase = await createClient();
  let initialInvoices: Invoice[] = [];
  let initialStudents: Student[] = [];
  let initialClasses: SchoolClass[] = [];
  let initialExpenses: Expense[] = [];
  let loadError: string | null = null;

  try {
    const [inv, stu, cls, exp] = await Promise.all([
      listInvoices(supabase),
      listStudents(supabase),
      listClasses(supabase),
      listExpenses(supabase),
    ]);
    initialInvoices = inv;
    initialStudents = stu;
    initialClasses = cls;
    initialExpenses = exp;
  } catch (err) {
    loadError = err instanceof Error ? err.message : 'load_failed';
  }

  return (
    <FinanceShell
      initialInvoices={initialInvoices}
      initialStudents={initialStudents}
      initialClasses={initialClasses}
      initialExpenses={initialExpenses}
      loadError={loadError}
    />
  );
}

