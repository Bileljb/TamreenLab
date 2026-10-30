import type { ComponentProps } from 'react';
import { AdSlot } from '@tamreen/ui';

/** An ad placement; NEXT_PUBLIC_ADS=off hides them all (for example before D5 picks a network). */
export function Ad(props: ComponentProps<typeof AdSlot>) {
  if (process.env.NEXT_PUBLIC_ADS === 'off') return null;
  return <AdSlot {...props} />;
}
