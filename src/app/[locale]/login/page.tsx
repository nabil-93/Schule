import { setRequestLocale } from 'next-intl/server';
import { LoginForm } from './LoginForm';

export default async function LoginPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ redirect?: string }>;
}) {
  const { locale } = await params;
  const { redirect } = await searchParams;
  setRequestLocale(locale);

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[hsl(var(--background))] p-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-brand-500/10 via-transparent to-brand-700/10"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -start-24 h-96 w-96 rounded-full bg-brand-500/20 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -end-24 h-96 w-96 rounded-full bg-brand-700/20 blur-3xl"
      />
      <LoginForm locale={locale} redirectTo={redirect} />
    </div>
  );
}
