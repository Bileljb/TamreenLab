import type { Metadata } from 'next';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { PageHero } from '@/components/PageHero';
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
    'inline-block rounded-lg border border-b-[3px] border-line-strong bg-canvas px-2 py-0.5 font-mono text-xs font-semibold text-ink-soft';

  return (
    <main className="flex flex-col">
      <PageHero title={t('title')} intro={t('intro')} />
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-10 px-4 py-10">
      {(Object.keys(GROUPS) as (keyof typeof GROUPS)[]).map((group) => (
        <section key={group} aria-labelledby={`g-${group}`} className="flex flex-col gap-2">
          <h2 id={`g-${group}`} className="text-xl font-bold">
            {t(`groups.${group}`)}
          </h2>
          <div className="overflow-x-auto rounded-[var(--radius-card)] border border-line bg-raised shadow-soft">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-muted">
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
                  <tr key={item} className="border-t border-line">
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
      </div>
    </main>
  );
}
