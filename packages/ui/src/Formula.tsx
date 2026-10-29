import type { ReactNode } from 'react';

type FormulaProps = {
  children: ReactNode;
  className?: string;
};

/**
 * Renders a formula or cell reference inside right-to-left text.
 * `<bdi dir="ltr">` isolates it so `=SUM(A1:B2)` never gets reordered by the Arabic context.
 */
export function Formula({ children, className }: FormulaProps) {
  return (
    <bdi dir="ltr" className={className} data-formula="">
      <code>{children}</code>
    </bdi>
  );
}
