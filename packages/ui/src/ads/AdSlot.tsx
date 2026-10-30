import { useTranslations } from 'next-intl';

/** Fixed sizes per placement: the space is reserved before any ad loads, so nothing shifts (CLS). */
export const AD_SIZES = {
  /** Between sections of an article (explanation, FAQ, function pages). */
  inline: 'h-[280px]',
  /** Between lesson cards in lists. */
  list: 'h-[120px]',
} as const;

type Props = {
  /** A stable name for the placement, reported to the ad network (decision D5). */
  name: string;
  size?: keyof typeof AD_SIZES;
};

/**
 * A provider-agnostic ad placement. Until an ad network is chosen (D5) it renders a neutral,
 * labelled placeholder of the final size. Never place it inside or beside the exercise player.
 */
export function AdSlot({ name, size = 'inline' }: Props) {
  const t = useTranslations('ads');
  return (
    <aside
      aria-label={t('label')}
      data-ad-slot={name}
      className={`${AD_SIZES[size]} flex w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-slate-300 bg-slate-100 text-xs text-slate-600`}
    >
      {t('placeholder')}
    </aside>
  );
}
