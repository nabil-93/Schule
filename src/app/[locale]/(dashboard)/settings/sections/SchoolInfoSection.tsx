'use client';

import { Building2, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { updateSchoolSettings } from '../actions';
import type { SchoolInfo } from '@/types';

export function SchoolInfoSection({ dbSchool }: { dbSchool: SchoolInfo | null }) {
  const t = useTranslations('settings.school');
  const tCommon = useTranslations('settings');

  const [draft, setDraft] = useState<SchoolInfo>(dbSchool || {
    name: 'École Moderne',
    academicYear: '2025-2026',
    address: '',
    phone: '',
    email: '',
  });
  
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const field =
    <K extends keyof SchoolInfo>(key: K) =>
    (e: ChangeEvent<HTMLInputElement>) =>
      setDraft((d) => ({ ...d, [key]: e.target.value } as SchoolInfo));

  const onLogoFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : undefined;
      setDraft(d => ({ ...d, logoUrl: dataUrl }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await updateSchoolSettings(draft);
      if (res.ok) {
        setSavedAt(Date.now());
        window.setTimeout(() => setSavedAt(null), 3000);
      } else {
        setError(res.error || 'save_failed');
      }
    });
  };

  return (
    <Card className="p-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">{t('title')}</h2>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <div className="flex items-start gap-4">
          <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-brand-50/50 dark:bg-brand-900/10">
            {draft.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={draft.logoUrl} alt="Logo" className="h-full w-full object-contain p-1" />
            ) : (
              <Building2 className="h-8 w-8 text-brand-600/40 dark:text-brand-400/40" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <p className="text-sm font-medium">{t('logo')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">{t('logoHint')}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {t('uploadLogo')}
              </Button>
              {draft.logoUrl && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-red-500 hover:bg-red-50 dark:hover:bg-red-950/30"
                  onClick={() => setDraft(d => ({ ...d, logoUrl: undefined }))}
                >
                  {t('removeLogo')}
                </Button>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={onLogoFile}
              />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 border-t pt-6 sm:grid-cols-2">
          <FormField label={t('name')} htmlFor="s-name">
            <Input id="s-name" value={draft.name} onChange={field('name')} required />
          </FormField>
          <FormField label={t('academicYear')} htmlFor="s-year">
            <Input
              id="s-year"
              value={draft.academicYear}
              onChange={field('academicYear')}
              placeholder="2025-2026"
              required
            />
          </FormField>
          <FormField label={t('address')} htmlFor="s-addr" className="sm:col-span-2">
            <Input id="s-addr" value={draft.address ?? ''} onChange={field('address')} />
          </FormField>
          <FormField label={t('phone')} htmlFor="s-phone">
            <Input id="s-phone" value={draft.phone ?? ''} onChange={field('phone')} />
          </FormField>
          <FormField label={t('email')} htmlFor="s-email">
            <Input
              id="s-email"
              type="email"
              value={draft.email ?? ''}
              onChange={field('email')}
            />
          </FormField>
        </div>

        {error && (
            <p className="text-sm text-red-600 dark:text-red-400">Error: {error}</p>
        )}

        <div className="flex items-center justify-end gap-3 border-t pt-4">
          {savedAt && (
            <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">
              ✓ {tCommon('saved')}
            </span>
          )}
          <Button type="submit" disabled={isPending}>
             {isPending ? tCommon('saving') : tCommon('save')}
          </Button>
        </div>
      </form>
    </Card>
  );
}
