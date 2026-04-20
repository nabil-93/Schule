'use client';

import { KeyRound, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';
import { useSettingsStore } from '@/lib/store/settings';

export function SecuritySection() {
  const t = useTranslations('settings.security');
  const tCommon = useTranslations('settings');

  const security = useSettingsStore((s) => s.security);
  const updateSecurity = useSettingsStore((s) => s.updateSecurity);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  const onSubmitPassword = (e: FormEvent) => {
    e.preventDefault();
    if (next !== confirm) {
      setError(t('passwordMismatch'));
      return;
    }
    setError(null);
    setCurrent('');
    setNext('');
    setConfirm('');
    setSavedAt(Date.now());
    window.setTimeout(() => setSavedAt(null), 2000);
  };

  return (
    <div className="space-y-4">
      <Card className="p-6">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
            <KeyRound className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{t('changePassword')}</h2>
            <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
          </div>
        </div>

        <form onSubmit={onSubmitPassword} className="mt-6 space-y-4">
          <FormField label={t('currentPassword')} htmlFor="pwd-current">
            <Input
              id="pwd-current"
              type="password"
              autoComplete="current-password"
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
              required
            />
          </FormField>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FormField label={t('newPassword')} htmlFor="pwd-new">
              <Input
                id="pwd-new"
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                required
                minLength={8}
              />
            </FormField>
            <FormField
              label={t('confirmPassword')}
              htmlFor="pwd-confirm"
              error={error ?? undefined}
            >
              <Input
                id="pwd-confirm"
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={8}
              />
            </FormField>
          </div>

          <div className="flex items-center justify-end gap-3 border-t pt-4">
            {savedAt && (
              <span className="text-sm text-emerald-600 dark:text-emerald-400">
                ✓ {tCommon('saved')}
              </span>
            )}
            <Button type="submit">{t('updatePassword')}</Button>
          </div>
        </form>
      </Card>

      <Card className="divide-y p-0">
        <div className="flex items-center justify-between gap-4 p-6">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium">{t('twoFactor')}</p>
              <p className="text-xs text-[hsl(var(--muted-foreground))]">
                {t('twoFactorHint')}
              </p>
            </div>
          </div>
          <Switch
            checked={security.twoFactorEnabled}
            onChange={(v) => updateSecurity({ twoFactorEnabled: v })}
            label={t('twoFactor')}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('loginAlerts')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('loginAlertsHint')}
            </p>
          </div>
          <Switch
            checked={security.loginAlerts}
            onChange={(v) => updateSecurity({ loginAlerts: v })}
            label={t('loginAlerts')}
          />
        </div>

        <div className="flex items-center justify-between gap-4 p-6">
          <div className="min-w-0">
            <p className="text-sm font-medium">{t('sessionTimeout')}</p>
            <p className="text-xs text-[hsl(var(--muted-foreground))]">
              {t('sessionTimeoutHint')}
            </p>
          </div>
          <Input
            type="number"
            min={5}
            max={240}
            step={5}
            value={security.sessionTimeoutMin}
            onChange={(e) =>
              updateSecurity({ sessionTimeoutMin: Number(e.target.value) || 30 })
            }
            className="w-28"
          />
        </div>
      </Card>
    </div>
  );
}
