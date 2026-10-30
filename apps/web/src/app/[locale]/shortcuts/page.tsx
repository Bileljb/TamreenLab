import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { pageMetadata } from '@/lib/seo';

type Props = { params: Promise<{ locale: string }> };

// Key names stay in English, as printed on most keyboards and in Excel's own menus.
const GROUPS = {
  navigation: [
    ['nextCell', 'Tab', 'Tab'],
    ['edge', 'Ctrl + →', '⌘ + →'],
    ['home', 'Ctrl + Home', 'Fn + Ctrl + ←'],
  ],
  selection: [
    ['selectRange', 'Shift + →', 'Shift + →'],
    ['selectEdge', 'Ctrl + Shift + ↓', '⌘ + Shift + ↓'],
    ['selectAll', 'Ctrl + A', '⌘ + A'],
  ],
  editing: [
    ['edit', 'F2', 'Ctrl + U'],
    ['cancel', 'Esc', 'Esc'],
    ['undo', 'Ctrl + Z', '⌘ + Z'],
    ['fillDown', 'Ctrl + D', '⌘ + D'],
  ],
  formulas: [
    ['autoSum', 'Alt + =', '⌘ + Shift + T'],
    ['absolute', 'F4', '⌘ + T'],
  ],
} as const;

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: 'shortcuts' });
  return pageMetadata({
    path: `/${locale}/shortcuts`,
    title: t('title'),
    description: t('description'),
  });
}

export default async function ShortcutsPage({ params }: Props) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations('shortcuts');
  const key =
    'inline-block rounded border border-slate-300 bg-slate-50 px-1.5 py-0.5 font-mono text-xs';

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-4 py-10">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">{t('title')}</h1>
        <p className="text-slate-600">{t('intro')}</p>
      </div>
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
        <section key={group} aria-labelledby={`g-${group}`} className="flex flex-col gap-2">
          <h2 id={`g-${group}`} className="text-xl font-bold">
            {t(`groups.${group}`)}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('action')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('windows')}
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    {t('mac')}
                  </th>
                </tr>
              </thead>
              <tbody>
                {GROUPS[group].map(([item, win, mac]) => (
                  <tr key={item} className="border-t border-slate-100">
                    <td className="px-3 py-2">{t(`items.${item}`)}</td>
                    <td className="px-3 py-2">
                      <kbd dir="ltr" className={key}>
                        {win}
                      </kbd>
                    </td>
                    <td className="px-3 py-2">
                      <kbd dir="ltr" className={key}>
                        {mac}
                      </kbd>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </main>
  );
}
