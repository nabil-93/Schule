import { getTranslations, setRequestLocale } from 'next-intl/server';
import { ProfileForm } from './ProfileForm';

export default async function ProfilePage({ params }: { params: { locale: string } }) {
  const { locale } = params;
  setRequestLocale(locale);
  const t = await getTranslations('profile');

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{t('title')}</h1>
        <p className="text-sm text-[hsl(var(--muted-foreground))]">{t('subtitle')}</p>
      </div>
      <ProfileForm />
    </div>
  );
}
