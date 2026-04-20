'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import type { UiUser } from '@/lib/queries/users';
import { resetUserPassword } from './actions';

function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (const v of arr) out += chars[v % chars.length];
  return out;
}

export function PasswordResetForm({
  user,
  onDone,
  onCancel,
}: {
  user: UiUser;
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('users');
  const tCommon = useTranslations('common');

  const [password, setPassword] = useState<string>(() => randomPassword());
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const [copied, setCopied] = useState(false);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      const res = await resetUserPassword(user.id, password);
      if (!res.ok) {
        setError(mapError(res.error, t));
        return;
      }
      onDone();
    });
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(password);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <p className="text-sm text-[hsl(var(--muted-foreground))]">
        {t('resetHint', { name: user.fullName })}
      </p>

      <FormField label={t('fields.newPassword')} htmlFor="rPassword">
        <div className="flex gap-2">
          <Input
            id="rPassword"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="button" variant="ghost" onClick={() => setPassword(randomPassword())}>
            {t('regenerate')}
          </Button>
          <Button type="button" variant="ghost" onClick={copy}>
            {copied ? tCommon('copied') : tCommon('copy')}
          </Button>
        </div>
      </FormField>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? tCommon('saving') : t('resetConfirm')}
        </Button>
      </div>
    </form>
  );
}

function mapError(code: string | undefined, t: ReturnType<typeof useTranslations<'users'>>): string {
  if (!code) return t('saveError');
  if (code.includes('SUPABASE_SERVICE_ROLE_KEY')) return t('serviceRoleMissing');
  if (code === 'forbidden' || code === 'not_authenticated') return t('forbidden');
  if (code === 'weak_password') return t('weakPassword');
  return code;
}
