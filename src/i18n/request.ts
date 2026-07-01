import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

const locales = ['en', 'ko', 'cn', 'ja'];

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value ?? 'en';
  const validLocale = locales.includes(locale) ? locale : 'en';

  return {
    locale: validLocale,
    messages: (await import(`../locales/${validLocale}.json`)).default,
  };
});
