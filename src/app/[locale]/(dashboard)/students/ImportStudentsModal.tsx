'use client';

import { AlertTriangle, CheckCircle2, Download, FileUp, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { useClassesStore } from '@/lib/store/classes';
import type { Student } from '@/types';
import { importStudents, type ImportSummary } from './actions';

type StudentInput = Omit<Student, 'id' | 'avatarUrl'>;

interface ParsedRow {
  row: StudentInput;
  errors: string[];
  original: Record<string, string>;
}

const REQUIRED_HEADERS = ['full_name', 'email'] as const;
const ALL_HEADERS = [
  'full_name',
  'email',
  'class_id',
  'admission_no',
  'date_of_birth',
  'parent_name',
  'attendance_rate',
  'fees_status',
  'status',
] as const;

const FEES_VALUES: Student['feesStatus'][] = ['paid', 'due', 'partial'];
const STATUS_VALUES: Student['status'][] = ['active', 'new', 'scholarship', 'inactive'];

function parseCsv(text: string): { headers: string[]; rows: string[][] } {
  const lines: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '"') {
      if (inQuotes && text[i + 1] === '"') {
        cur += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      lines.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) lines.push(cur);

  const parseLine = (line: string): string[] => {
    const cells: string[] = [];
    let c = '';
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQ && line[i + 1] === '"') {
          c += '"';
          i++;
        } else {
          inQ = !inQ;
        }
      } else if (ch === ',' && !inQ) {
        cells.push(c);
        c = '';
      } else {
        c += ch;
      }
    }
    cells.push(c);
    return cells.map((x) => x.trim());
  };

  const nonEmpty = lines.filter((l) => l.trim().length > 0);
  if (nonEmpty.length === 0) return { headers: [], rows: [] };
  const headers = parseLine(nonEmpty[0]).map((h) => h.toLowerCase());
  const rows = nonEmpty.slice(1).map(parseLine);
  return { headers, rows };
}

const TEMPLATE_CSV =
  'full_name,email,class_id,admission_no,date_of_birth,parent_name,attendance_rate,fees_status,status\n' +
  'John Doe,john@example.com,,,2012-03-15,Jane Doe,95,paid,active\n';

interface Props {
  onDone: () => void;
  onCancel: () => void;
}

export function ImportStudentsModal({ onDone, onCancel }: Props) {
  const t = useTranslations('students.import');
  const tCommon = useTranslations('common');
  const classes = useClassesStore((s) => s.classes);
  const classIds = useMemo(() => new Set(classes.map((c) => c.id)), [classes]);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [parsed, setParsed] = useState<ParsedRow[] | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [submitting, startSubmit] = useTransition();

  const handleFile = async (file: File) => {
    setGlobalError(null);
    setSummary(null);
    const text = await file.text();
    const { headers, rows } = parseCsv(text);

    for (const req of REQUIRED_HEADERS) {
      if (!headers.includes(req)) {
        setGlobalError(t('missingHeader', { header: req }));
        setParsed(null);
        return;
      }
    }

    const seen = new Set<string>();
    const out: ParsedRow[] = rows.map((cells) => {
      const obj: Record<string, string> = {};
      headers.forEach((h, i) => {
        obj[h] = cells[i] ?? '';
      });
      const errors: string[] = [];
      const fullName = (obj.full_name ?? '').trim();
      const email = (obj.email ?? '').trim().toLowerCase();

      if (!fullName) errors.push(t('errors.missingName'));
      if (!email) errors.push(t('errors.missingEmail'));
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push(t('errors.invalidEmail'));
      else if (seen.has(email)) errors.push(t('errors.duplicateEmail'));
      else seen.add(email);

      const classId = (obj.class_id ?? '').trim() || null;
      if (classId && !classIds.has(classId)) errors.push(t('errors.unknownClass'));

      const attendanceRateRaw = (obj.attendance_rate ?? '').trim();
      let attendanceRate = 0;
      if (attendanceRateRaw) {
        const n = Number(attendanceRateRaw);
        if (Number.isNaN(n) || n < 0 || n > 100) errors.push(t('errors.invalidAttendance'));
        else attendanceRate = n;
      }

      const feesRaw = ((obj.fees_status ?? '').trim().toLowerCase() || 'paid') as Student['feesStatus'];
      if (!FEES_VALUES.includes(feesRaw)) errors.push(t('errors.invalidFees'));

      const statusRaw = ((obj.status ?? '').trim().toLowerCase() || 'active') as Student['status'];
      if (!STATUS_VALUES.includes(statusRaw)) errors.push(t('errors.invalidStatus'));

      const dob = (obj.date_of_birth ?? '').trim();
      if (dob && !/^\d{4}-\d{2}-\d{2}$/.test(dob)) errors.push(t('errors.invalidDate'));

      const row: StudentInput = {
        fullName,
        email,
        classId,
        parentName: (obj.parent_name ?? '').trim(),
        dateOfBirth: dob,
        admissionNo: (obj.admission_no ?? '').trim(),
        attendanceRate,
        feesStatus: feesRaw,
        status: statusRaw,
      };

      return { row, errors, original: obj };
    });

    setParsed(out);
  };

  const validRows = useMemo(
    () => (parsed ?? []).filter((r) => r.errors.length === 0).map((r) => r.row),
    [parsed],
  );
  const invalidCount = useMemo(
    () => (parsed ?? []).filter((r) => r.errors.length > 0).length,
    [parsed],
  );

  const downloadTemplate = () => {
    const blob = new Blob([TEMPLATE_CSV], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'students_template.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = () => {
    if (validRows.length === 0) return;
    setGlobalError(null);
    startSubmit(async () => {
      const res = await importStudents(validRows);
      setSummary(res);
      if (!res.ok && res.error) {
        setGlobalError(res.error);
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('hint')}</p>
        <Button variant="ghost" size="sm" onClick={downloadTemplate}>
          <Download className="h-4 w-4" />
          {t('downloadTemplate')}
        </Button>
      </div>

      <div className="rounded-lg border border-dashed p-6 text-center">
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
            e.target.value = '';
          }}
        />
        <FileUp className="mx-auto mb-2 h-8 w-8 text-[hsl(var(--muted-foreground))]" />
        <p className="mb-3 text-sm">{t('dropHint')}</p>
        <Button size="sm" onClick={() => fileInputRef.current?.click()}>
          {t('chooseFile')}
        </Button>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          {t('headersHint', { headers: ALL_HEADERS.join(', ') })}
        </p>
      </div>

      {globalError && (
        <Card className="flex items-center gap-2 border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          <span>{globalError}</span>
        </Card>
      )}

      {parsed && !summary && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <CheckCircle2 className="h-4 w-4" />
              {t('validCount', { count: validRows.length })}
            </span>
            {invalidCount > 0 && (
              <span className="inline-flex items-center gap-1.5 text-red-700 dark:text-red-300">
                <XCircle className="h-4 w-4" />
                {t('invalidCount', { count: invalidCount })}
              </span>
            )}
          </div>

          <div className="max-h-80 overflow-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead className="sticky top-0 border-b bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-2 py-2 text-start font-medium">#</th>
                  <th className="px-2 py-2 text-start font-medium">{t('col.name')}</th>
                  <th className="px-2 py-2 text-start font-medium">{t('col.email')}</th>
                  <th className="px-2 py-2 text-start font-medium">{t('col.class')}</th>
                  <th className="px-2 py-2 text-start font-medium">{t('col.status')}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {parsed.map((p, i) => (
                  <tr
                    key={i}
                    className={p.errors.length ? 'bg-red-50/60 dark:bg-red-950/20' : ''}
                  >
                    <td className="px-2 py-1.5 tabular-nums text-[hsl(var(--muted-foreground))]">
                      {i + 1}
                    </td>
                    <td className="px-2 py-1.5">{p.row.fullName || '—'}</td>
                    <td className="px-2 py-1.5">{p.row.email || '—'}</td>
                    <td className="px-2 py-1.5">{p.row.classId || '—'}</td>
                    <td className="px-2 py-1.5">
                      {p.errors.length === 0 ? (
                        <span className="text-emerald-700 dark:text-emerald-300">OK</span>
                      ) : (
                        <span className="text-red-700 dark:text-red-300">
                          {p.errors.join(', ')}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {summary && (
        <div className="space-y-3">
          <Card className="flex items-center gap-3 p-3 text-sm">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>
              {t('result.summary', { created: summary.created, failed: summary.failed })}
            </span>
          </Card>
          {summary.failed > 0 && (
            <div className="max-h-48 overflow-auto rounded-lg border">
              <table className="w-full text-xs">
                <thead className="border-b bg-[hsl(var(--card))] text-[hsl(var(--muted-foreground))]">
                  <tr>
                    <th className="px-2 py-2 text-start font-medium">{t('col.email')}</th>
                    <th className="px-2 py-2 text-start font-medium">{t('col.error')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {summary.results
                    .filter((r) => !r.ok)
                    .map((r) => (
                      <tr key={r.index}>
                        <td className="px-2 py-1.5">{r.email}</td>
                        <td className="px-2 py-1.5 text-red-700 dark:text-red-300">
                          {r.error ?? '—'}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center justify-end gap-2 pt-2">
        {summary ? (
          <>
            <Button variant="ghost" onClick={onCancel}>
              {tCommon('close')}
            </Button>
            <Button onClick={onDone}>{tCommon('confirm')}</Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onCancel}>
              {tCommon('cancel')}
            </Button>
            <Button
              onClick={handleImport}
              disabled={!parsed || validRows.length === 0 || submitting}
            >
              {submitting
                ? tCommon('loading')
                : t('importButton', { count: validRows.length })}
            </Button>
          </>
        )}
      </div>

    </div>
  );
}
