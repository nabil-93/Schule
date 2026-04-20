'use client';

import { Camera, Check, Save, Trash2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useMemo, useRef, useState, useTransition } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { routing, type Locale } from '@/i18n/routing';
import { updateMyProfile } from './actions';

export function ProfileForm() {
  const t = useTranslations('profile');
  const tRoles = useTranslations('roles');
  const tLang = useTranslations('languages');
  const locale = useLocale() as Locale;
  const router = useRouter();

  const { user, uiRole } = useAuth();
  const profile = user.profile;

  const [fullName, setFullName] = useState(profile.full_name);
  const [email] = useState(profile.email);
  const [phone, setPhone] = useState(profile.phone ?? '');
  const [language, setLanguage] = useState(profile.language ?? 'fr');
  const [address, setAddress] = useState(profile.address ?? '');
  const [bio, setBio] = useState(profile.bio ?? '');

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile.avatar_url ?? null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, startSave] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const displaySrc = useMemo(() => {
    if (removeAvatar) return undefined;
    if (previewUrl) return previewUrl;
    return avatarUrl ?? undefined;
  }, [previewUrl, avatarUrl, removeAvatar]);

  const dirty =
    fullName !== profile.full_name ||
    phone !== (profile.phone ?? '') ||
    language !== (profile.language ?? 'fr') ||
    address !== (profile.address ?? '') ||
    bio !== (profile.bio ?? '') ||
    pendingFile !== null ||
    removeAvatar;

  const onPickFile = (file: File | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError(t('invalidImage'));
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError(t('imageTooLarge'));
      return;
    }
    setError(null);
    setRemoveAvatar(false);
    setPendingFile(file);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearAvatar = () => {
    setRemoveAvatar(true);
    setPendingFile(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
  };

  const onSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!dirty) return;
    setError(null);
    startSave(async () => {
      let newAvatarUrl: string | null | undefined = undefined;

      if (pendingFile) {
        const supabase = createClient();
        const ext = pendingFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const path = `${profile.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('avatars')
          .upload(path, pendingFile, { upsert: true, contentType: pendingFile.type });
        if (upErr) {
          setError(upErr.message);
          return;
        }
        const { data } = supabase.storage.from('avatars').getPublicUrl(path);
        newAvatarUrl = data.publicUrl;
      } else if (removeAvatar) {
        newAvatarUrl = null;
      }

      const res = await updateMyProfile({
        fullName,
        phone: phone || null,
        language,
        address: address || null,
        bio: bio || null,
        ...(newAvatarUrl !== undefined ? { avatarUrl: newAvatarUrl } : {}),
      });

      if (!res.ok) {
        setError(res.error ?? 'save_failed');
        return;
      }

      if (newAvatarUrl !== undefined) setAvatarUrl(newAvatarUrl);
      setPendingFile(null);
      setRemoveAvatar(false);
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
        setPreviewUrl(null);
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
      router.refresh();
    });
  };

  const onReset = () => {
    setFullName(profile.full_name);
    setPhone(profile.phone ?? '');
    setLanguage(profile.language ?? 'fr');
    setAddress(profile.address ?? '');
    setBio(profile.bio ?? '');
    setPendingFile(null);
    setRemoveAvatar(false);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    setError(null);
  };

  return (
    <form onSubmit={onSave} className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <Card className="lg:col-span-1">
        <CardHeader>
          <CardTitle>{t('uploadPhoto')}</CardTitle>
          <CardDescription>{t('uploadHint')}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <div className="relative">
            <Avatar name={fullName} src={displaySrc} size={128} className="ring-4" />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 end-0 flex h-9 w-9 items-center justify-center rounded-full bg-brand-600 text-white shadow-md ring-2 ring-[hsl(var(--card))] hover:bg-brand-700"
              aria-label={t('uploadPhoto')}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
          </div>
          <div className="text-center">
            <div className="text-sm font-semibold">{fullName}</div>
            <div className="text-xs text-[hsl(var(--muted-foreground))]">{email}</div>
            <Badge tone="brand" className="mt-2">{tRoles(uiRole)}</Badge>
          </div>
          {(displaySrc || pendingFile) && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clearAvatar}
              className="text-red-600 hover:bg-red-50 dark:hover:bg-red-500/10"
            >
              <Trash2 className="h-4 w-4" />
              {t('removePhoto')}
            </Button>
          )}
          {pendingFile && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {t('pendingSave')}
            </p>
          )}
        </CardContent>
      </Card>

      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>{t('title')}</CardTitle>
          <CardDescription>{t('editInfo')}</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FormField label={t('fullName')} htmlFor="fullName" className="sm:col-span-2">
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
            />
          </FormField>

          <FormField label={t('email')} htmlFor="email">
            <Input id="email" type="email" value={email} disabled />
          </FormField>

          <FormField label={t('phone')} htmlFor="phone">
            <Input id="phone" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </FormField>

          <FormField
            label={t('language')}
            htmlFor="language"
            hint={`${t('currentLocaleHint')} ${locale.toUpperCase()}`}
          >
            <Select
              id="language"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
            >
              {routing.locales.map((l) => (
                <option key={l} value={l}>{tLang(l)}</option>
              ))}
            </Select>
          </FormField>

          <FormField label={t('address')} htmlFor="address" className="sm:col-span-2">
            <Input
              id="address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </FormField>

          <FormField label={t('bio')} htmlFor="bio" className="sm:col-span-2">
            <textarea
              id="bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full rounded-lg border bg-[hsl(var(--card))] px-3 py-2 text-sm placeholder:text-[hsl(var(--muted-foreground))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:border-brand-500"
            />
          </FormField>
        </CardContent>

        {error && <p className="px-6 pb-2 text-xs text-red-600">{error}</p>}

        <div className="flex items-center justify-end gap-3 border-t bg-[hsl(var(--muted))]/40 px-6 py-4">
          {saved && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
              <Check className="h-3.5 w-3.5" />
              {t('saved')}
            </span>
          )}
          <Button type="button" variant="ghost" onClick={onReset} disabled={!dirty || saving}>
            {t('reset')}
          </Button>
          <Button type="submit" disabled={!dirty || saving}>
            <Save className="h-4 w-4" />
            {saving ? t('saving') : t('save')}
          </Button>
        </div>
      </Card>
    </form>
  );
}
