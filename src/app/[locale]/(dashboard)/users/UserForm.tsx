'use client';

import { useTranslations } from 'next-intl';
import { useState, useTransition, type FormEvent } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import type { Role } from '@/types';
import type { UiUser } from '@/lib/queries/users';
import {
  createUser,
  updateUser,
  type CreateUserInput,
  type UpdateUserInput,
  type UiRoleChoice,
} from './actions';

function randomPassword(len = 12): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%&*';
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  let out = '';
  for (const v of arr) out += chars[v % chars.length];
  return out;
}

export function UserForm({
  initial,
  roleChoices,
  onDone,
  onCancel,
}: {
  initial?: UiUser;
  roleChoices: Role[];
  onDone: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations('users');
  const tRoles = useTranslations('roles');
  const tCommon = useTranslations('common');

  const defaultRole: UiRoleChoice =
    (initial?.role as UiRoleChoice | undefined) ?? (roleChoices[0] as UiRoleChoice) ?? 'student';

  const [fullName, setFullName] = useState(initial?.fullName ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [phone, setPhone] = useState(initial?.phone ?? '');
  const [role, setRole] = useState<UiRoleChoice>(defaultRole);
  const [password, setPassword] = useState<string>(() => (initial ? '' : randomPassword()));
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    startSave(async () => {
      if (initial) {
        const payload: UpdateUserInput = { fullName, email, phone, role };
        const res = await updateUser(initial.id, payload);
        if (!res.ok) {
          setError(mapError(res.error, t));
          return;
        }
      } else {
        const payload: CreateUserInput = { fullName, email, phone, role, password };
        const res = await createUser(payload);
        if (!res.ok) {
          setError(mapError(res.error, t));
          return;
        }
      }
      onDone();
    });
  };

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <FormField label={t('fields.fullName')} htmlFor="uFullName" className="sm:col-span-2">
          <Input
            id="uFullName"
            required
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
        </FormField>

        <FormField label={t('fields.email')} htmlFor="uEmail">
          <Input
            id="uEmail"
            type="email"
            required
            disabled={!!initial}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        <FormField label={t('fields.phone')} htmlFor="uPhone">
          <Input
            id="uPhone"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
        </FormField>

        <FormField label={t('fields.role')} htmlFor="uRole">
          <Select
            id="uRole"
            value={role}
            onChange={(e) => setRole(e.target.value as UiRoleChoice)}
          >
            {roleChoices.map((r) => (
              <option key={r} value={r}>
                {tRoles(r)}
              </option>
            ))}
          </Select>
        </FormField>

        {!initial && (
          <FormField
            label={t('fields.tempPassword')}
            htmlFor="uPassword"
            className="sm:col-span-2"
            hint={t('fields.tempPasswordHint')}
          >
            <div className="flex gap-2">
              <Input
                id="uPassword"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <Button
                type="button"
                variant="ghost"
                onClick={() => setPassword(randomPassword())}
              >
                {t('regenerate')}
              </Button>
            </div>
          </FormField>
        )}
      </div>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <div className="flex items-center justify-end gap-2 border-t pt-4">
        <Button type="button" variant="ghost" onClick={onCancel} disabled={saving}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving ? tCommon('saving') : tCommon('save')}
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
  if (code === 'invalid_input') return t('invalidInput');
  return code;
}
