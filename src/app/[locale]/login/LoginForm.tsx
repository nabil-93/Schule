'use client';

import { Eye, EyeOff, GraduationCap, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { FormField } from '@/components/ui/FormField';
import { Input } from '@/components/ui/Input';
import { createClient } from '@/lib/supabase/client';

export function LoginForm({
  locale,
  redirectTo,
}: {
  locale: string;
  redirectTo?: string;
}) {
  const t = useTranslations('auth');
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError(
        signInError.message.toLowerCase().includes('invalid')
          ? t('invalidCredentials')
          : t('unexpectedError'),
      );
      setLoading(false);
      return;
    }

    try {
      await supabase.rpc('log_login', { p_user_agent: navigator.userAgent });
    } catch {
      // non-fatal
    }

    const target = redirectTo && redirectTo.startsWith('/') ? redirectTo : `/${locale}`;
    router.replace(target);
    router.refresh();
  }

  return (
    <div className="relative z-10 w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 text-white shadow-lg shadow-brand-600/30">
          <GraduationCap className="h-7 w-7" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('welcome')}</h1>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {t('subtitle')}
        </p>
      </div>

      <div className="rounded-2xl border bg-[hsl(var(--card))] p-6 shadow-xl shadow-black/5 sm:p-8">
        <form onSubmit={onSubmit} className="space-y-4" noValidate>
          <FormField label={t('email')} htmlFor="email">
            <Input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('emailPlaceholder')}
              disabled={loading}
            />
          </FormField>

          <FormField label={t('password')} htmlFor="password">
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t('passwordPlaceholder')}
                disabled={loading}
                className="pe-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? t('hidePassword') : t('showPassword')}
                className="absolute inset-y-0 end-0 flex items-center px-3 text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </FormField>

          {error && (
            <div
              role="alert"
              className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"
            >
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>{t('signingIn')}</span>
              </>
            ) : (
              t('signIn')
            )}
          </Button>
        </form>
      </div>

      <p className="mt-6 text-center text-xs text-[hsl(var(--muted-foreground))]">
        {t('footer')}
      </p>
    </div>
  );
}
